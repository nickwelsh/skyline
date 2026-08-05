<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use NickWelsh\Skyline\Read\Nanoseconds;
use NickWelsh\Skyline\Telemetry\SqlCapture;
use Tests\Fixtures\Jobs\CacheStrategyJob;
use Tests\Fixtures\Jobs\ChildJob;
use Tests\Fixtures\Jobs\FailingJob;
use Tests\Fixtures\Jobs\HttpJob;
use Tests\Fixtures\Jobs\ParentJob;
use Tests\Fixtures\Jobs\SqlJob;
use Tests\Fixtures\Jobs\StorageDetailJob;
use Tests\Fixtures\Jobs\SummaryJob;

it('serves stable 25-row opaque cursor pages and filter options', function (): void {
    for ($index = 0; $index < 27; $index++) {
        seedReadRun($index, $index % 2 === 0 ? 'completed' : 'failed');
    }
    seedReadRun(99, 'queued', false);

    $first = $this->getJson('/skyline/api/runs')
        ->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonCount(25, 'runs')
        ->assertJsonPath('pagination.previous', null)
        ->assertJsonPath('hasAnyRuns', true);
    $next = $first->json('pagination.next');

    expect($first->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')
        ->and($next)->toBeString()->not->toContain('run-');

    $second = $this->getJson('/skyline/api/runs?'.http_build_query(['cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(2, 'runs')
        ->assertJsonPath('pagination.next', null);
    $previous = $second->json('pagination.previous');
    $back = $this->getJson('/skyline/api/runs?'.http_build_query(['cursor' => $previous]))->assertOk();

    $this->getJson('/skyline/api/runs/'.$second->json('runs.0.id').'?'.http_build_query([
        'tableState' => $second->json('tableState'),
    ]))->assertOk()->assertJsonPath('navigation.listCursor', $next);

    expect($back->json('runs'))->toBe($first->json('runs'))
        ->and($first->json('options.statuses'))->toBe(['queued', 'running', 'retrying', 'completed', 'failed'])
        ->and($first->json('options.jobNames'))->toHaveCount(27)
        ->and(collect($first->json('runs'))->pluck('id'))->not->toContain('run-99');
});

it('filters Runs and rejects invalid query state explicitly', function (): void {
    seedReadRun(1, 'completed', true, 'App\\Jobs\\Alpha', 'redis', 'mail');
    seedReadRun(2, 'failed', true, 'App\\Jobs\\Beta', 'database', 'default');

    $this->getJson('/skyline/api/runs?'.http_build_query([
        'status' => ['completed'],
        'job' => 'App\\Jobs\\Alpha',
        'connection' => 'redis',
        'queue' => 'mail',
        'search' => 'alpha',
    ]))->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.id', 'run-01');

    $this->getJson('/skyline/api/runs?connection=redis')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
    $this->getJson('/skyline/api/runs?cursor=not-a-cursor')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('polls changed active rows and counts filtered new Runs', function (): void {
    seedReadRun(1, 'completed');
    $page = $this->getJson('/skyline/api/runs')->assertOk();
    $pollCursor = $page->json('pollCursor');
    seedReadRun(2, 'running');

    $response = $this->getJson('/skyline/api/runs/updates?'.http_build_query(['since' => $pollCursor]))
        ->assertOk()
        ->assertJsonPath('newRunCount', 1)
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.id', 'run-02');

    expect($response->json('pollCursor'))->toBeString();
});

it('returns terminal transitions for the active Run selection', function (): void {
    seedReadRun(1, 'running');
    $page = $this->getJson('/skyline/api/runs')->assertOk();
    DB::table('skyline_runs')->where('run_id', 'run-01')->update([
        'status' => 'completed',
        'finished_at' => Nanoseconds::now(),
    ]);
    DB::table('skyline_traces')->update(['last_activity_at' => Nanoseconds::now() + 1_000_000]);

    $this->getJson('/skyline/api/runs/updates?'.http_build_query([
        'since' => $page->json('pollCursor'),
        'runIds' => ['run-01'],
        'status' => ['running'],
    ]))->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.status', 'completed');
});

it('round trips emitted RFC 3339 timestamps through time filters', function (): void {
    seedReadRun(1, 'completed');
    $run = $this->getJson('/skyline/api/runs')->assertOk()->json('runs.0');

    $this->getJson('/skyline/api/runs?'.http_build_query([
        'triggeredFrom' => $run['triggeredAt'],
        'triggeredTo' => $run['triggeredAt'],
    ]))->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.id', 'run-01');
});

it('derives adjacent Runs from preserved table state and safely falls back when invalid', function (): void {
    seedReadRun(0, 'completed');
    seedReadRun(1, 'completed');
    seedReadRun(2, 'failed');
    $page = $this->getJson('/skyline/api/runs?'.http_build_query(['status' => ['completed']]))->assertOk();

    $this->getJson('/skyline/api/runs/run-01?'.http_build_query(['tableState' => $page->json('tableState')]))
        ->assertOk()
        ->assertJsonPath('navigation.previousRunId', 'run-00')
        ->assertJsonPath('navigation.nextRunId', null)
        ->assertJsonPath('navigation.tableState', $page->json('tableState'));

    $this->getJson('/skyline/api/runs/run-01?tableState=invalid')
        ->assertOk()
        ->assertJsonPath('navigation.previousRunId', 'run-00')
        ->assertJsonPath('navigation.nextRunId', 'run-02');
});

it('serves revision-safe Trace and parameterized SQL inspector DTOs with ETags', function (): void {
    SqlJob::dispatchSync('private-job-payload');
    $run = DB::table('skyline_runs')->where('job_name', SqlJob::class)->first();
    $span = DB::table('skyline_spans')->where('role', 'sql')->first();

    $trace = $this->getJson('/skyline/api/runs/'.$run->run_id)
        ->assertOk()
        ->assertJsonPath('run.id', $run->run_id)
        ->assertJsonPath('trace.nodes.0.id', 'run_'.$run->run_id)
        ->assertJsonPath('trace.nodes.0.kind', 'run')
        ->assertJsonPath('trace.nodes.1.kind', 'attempt')
        ->assertJsonPath('trace.nodes.2.kind', 'query');
    $etag = $trace->headers->get('ETag');

    expect($trace->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');

    $this->withHeader('If-None-Match', $etag)
        ->get('/skyline/api/runs/'.$run->run_id)
        ->assertStatus(304)
        ->assertHeader('ETag', $etag);

    $inspector = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.kind', 'query')
        ->assertJsonPath('node.sql.value', 'select ? as private_value')
        ->assertJsonPath('node.sql.isTruncated', false)
        ->assertJsonPath('node.overview.spanId', $span->span_id);
    $nodeEtag = $inspector->headers->get('ETag');

    $this->withHeader('If-None-Match', $nodeEtag)
        ->get('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertStatus(304)
        ->assertHeader('ETag', $nodeEtag);

    expect($inspector->getContent())
        ->not->toContain('private-job-payload')
        ->not->toContain('do-not-capture');
});

it('serves opt-in SQL bindings and result previews outside generic metadata', function (): void {
    config()->set('skyline.sql.capture_bindings', true);
    config()->set('skyline.sql.capture_results', true);
    config()->set('skyline.sql.capture_source', true);
    config()->set('app.editor', ['name' => 'phpstorm', 'base_path' => '/workspace/skyline']);
    app(SqlCapture::class)->boot();
    SqlJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', SqlJob::class)->first();
    $span = DB::table('skyline_spans')->where('role', 'sql')->first();

    $inspector = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.bindings.items.0.position', 0)
        ->assertJsonPath('node.bindings.items.0.value', 'do-not-capture')
        ->assertJsonPath('node.bindings.truncated', false)
        ->assertJsonPath('node.result.kind', 'rows')
        ->assertJsonPath('node.result.rowCount', 1)
        ->assertJsonPath('node.result.rows.0.private_value', 'do-not-capture')
        ->assertJsonPath('node.result.truncated', false)
        ->assertJsonPath('node.source.file', 'tests/Fixtures/Jobs/SqlJob.php');

    expect(data_get($inspector->json(), 'node.metadata.value.attributes.skyline.sql.bindings'))->toBeNull()
        ->and(data_get($inspector->json(), 'node.metadata.value.attributes.skyline.sql.result'))->toBeNull()
        ->and(data_get($inspector->json(), 'node.metadata.value.attributes.skyline.sql.source.file'))->toBeNull()
        ->and($inspector->json('node.source.line'))->toBeInt()->toBeGreaterThan(0)
        ->and($inspector->json('node.source.href'))->toStartWith('phpstorm://open?file=')
        ->toContain('/tests/Fixtures/Jobs/SqlJob.php&line=');
});

it('serves outgoing HTTP timeline nodes and captured request response details', function (): void {
    config()->set('skyline.http.capture_request_headers', true);
    config()->set('skyline.http.capture_request_body', true);
    config()->set('skyline.http.capture_response_headers', true);
    config()->set('skyline.http.capture_response_body', true);
    config()->set('skyline.http.capture_source', true);
    config()->set('app.editor', 'vscode');
    Http::fake([
        'api.example.test/*' => Http::response(['id' => 42], 201, [
            'Content-Type' => 'application/json',
            'Set-Cookie' => 'session=response-secret',
        ]),
    ]);

    HttpJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', HttpJob::class)->first();
    $span = DB::table('skyline_spans')->where('role', 'http')->orderBy('started_at')->first();

    $this->getJson('/skyline/api/runs/'.$run->run_id)
        ->assertOk()
        ->assertJsonPath('trace.nodes.2.kind', 'request')
        ->assertJsonPath('trace.nodes.2.label', 'POST https://api.example.test/people?token=%5BREDACTED%5D');

    $inspector = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.kind', 'request')
        ->assertJsonPath('node.http.method', 'POST')
        ->assertJsonPath('node.http.url', 'https://api.example.test/people?token=%5BREDACTED%5D')
        ->assertJsonPath('node.http.statusCode', 201)
        ->assertJsonPath('node.http.request.headers.items.Authorization.0', '[REDACTED]')
        ->assertJsonPath('node.http.request.body.json.name', 'Laravel')
        ->assertJsonPath('node.http.response.headers.items.Set-Cookie.0', '[REDACTED]')
        ->assertJsonPath('node.http.response.body.json.id', 42)
        ->assertJsonPath('node.source.file', 'tests/Fixtures/Jobs/HttpJob.php');

    expect(data_get($inspector->json(), 'node.metadata.value.attributes.skyline.http.request.body'))->toBeNull()
        ->and(data_get($inspector->json(), 'node.metadata.value.attributes.skyline.http.response.body'))->toBeNull()
        ->and($inspector->json('node.source.href'))->toStartWith('vscode://file/');
});

it('serves operation-specific cache and storage details', function (): void {
    CacheStrategyJob::dispatchSync();
    $cacheRun = DB::table('skyline_runs')->where('job_name', CacheStrategyJob::class)->first();
    $cacheSpan = DB::table('skyline_spans')
        ->where('run_id', $cacheRun->run_id)
        ->where('role', 'cache')
        ->where('attributes', 'like', '%stale_while_revalidate%')
        ->where('attributes', 'like', '%"cache.operation":"PUT"%')
        ->first();

    $this->getJson('/skyline/api/runs/'.$cacheRun->run_id.'/nodes/span_'.$cacheSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.cache.operation', 'PUT')
        ->assertJsonPath('node.cache.strategy', 'stale_while_revalidate')
        ->assertJsonPath('node.cache.freshTtlSeconds', 30)
        ->assertJsonPath('node.cache.ttlSeconds', 120)
        ->assertJsonPath('node.cache.keyCaptured', false)
        ->assertJsonPath('node.cache.outcome', 'stored');

    $root = storage_path('framework/testing/disks/read-storage-details');
    config()->set('filesystems.disks.telemetry', ['driver' => 'local', 'root' => $root, 'throw' => true]);
    config()->set('skyline.storage.capture_paths', true);
    config()->set('skyline.storage.links.telemetry', 'https://files.example.test/{path}');
    config()->set('app.editor', 'vscode');
    StorageDetailJob::dispatchSync();
    $storageRun = DB::table('skyline_runs')->where('job_name', StorageDetailJob::class)->first();
    $storageSpan = DB::table('skyline_spans')
        ->where('run_id', $storageRun->run_id)
        ->where('role', 'storage')
        ->where('attributes', 'like', '%"storage.operation":"write"%')
        ->first();

    $this->getJson('/skyline/api/runs/'.$storageRun->run_id.'/nodes/span_'.$storageSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.storage.operation', 'write')
        ->assertJsonPath('node.storage.path', 'reports/customer report.txt')
        ->assertJsonPath('node.storage.pathCaptured', true)
        ->assertJsonPath('node.storage.url', 'https://files.example.test/reports/customer%20report.txt')
        ->assertJsonPath('node.storage.localFile.path', $root.'/reports/customer report.txt')
        ->assertJsonPath('node.storage.localFile.href', 'vscode://file/'.$root.'/reports/customer report.txt:1')
        ->assertJsonPath('node.storage.outcome', 'completed');
});

it('presents log breadcrumbs as chronological selectable nodes with details', function (): void {
    config()->set('skyline.logging.enabled', true);
    SummaryJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', SummaryJob::class)->first();
    $nodes = collect($this->getJson('/skyline/api/runs/'.$run->run_id)
        ->assertOk()
        ->json('trace.nodes'));
    $breadcrumbs = $nodes->where('kind', 'breadcrumb')->values();
    $warningIndex = $nodes->search(fn (array $node): bool => $node['id'] === $breadcrumbs[0]['id']);
    $queryIndex = $nodes->search(fn (array $node): bool => $node['kind'] === 'query');
    $errorIndex = $nodes->search(fn (array $node): bool => $node['id'] === $breadcrumbs[1]['id']);

    expect($breadcrumbs)->toHaveCount(2)
        ->and($breadcrumbs->pluck('logLevel')->all())->toBe(['warning', 'error'])
        ->and($breadcrumbs[0]['label'])->toBe('WARNING · Import token=[REDACTED] delayed')
        ->and($breadcrumbs[1]['label'])->toBe('ERROR · Import failed password=[REDACTED]')
        ->and($warningIndex)->toBeLessThan($queryIndex)
        ->and($errorIndex)->toBeGreaterThan($queryIndex)
        ->and(collect($nodes->firstWhere('kind', 'attempt')['timelineEvents'])->where('kind', 'breadcrumb'))->toBeEmpty();

    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/'.$breadcrumbs[0]['id'])
        ->assertOk()
        ->assertJsonPath('node.kind', 'breadcrumb')
        ->assertJsonPath('node.breadcrumb.level', 'warning')
        ->assertJsonPath('node.breadcrumb.channel', 'stack')
        ->assertJsonPath('node.breadcrumb.message', 'Import token=[REDACTED] delayed')
        ->assertJsonPath('node.breadcrumb.context.code', 429)
        ->assertJsonMissingPath('node.breadcrumb.context.password');
});

it('returns curated relative exception details without raw stack metadata', function (): void {
    config()->set('app.editor', 'vscode');
    expect(fn () => FailingJob::dispatchSync())->toThrow(RuntimeException::class);
    $run = DB::table('skyline_runs')->where('job_name', FailingJob::class)->first();
    $attempt = DB::table('skyline_attempts')->where('run_id', $run->run_id)->first();
    $node = 'attempt_'.$run->run_id.'_'.$attempt->attempt_number;

    $response = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/'.$node)
        ->assertOk()
        ->assertJsonPath('node.exception.class', RuntimeException::class)
        ->assertJsonPath('node.exception.message', 'Expected Job failure.')
        ->assertJsonPath('node.exception.messageTruncated', false);

    expect($response->json('node.exception.location.file'))->toBe('tests/Fixtures/Jobs/FailingJob.php')
        ->and($response->json('node.exception.frames.0.file'))->toBe('tests/Fixtures/Jobs/FailingJob.php')
        ->and($response->json('node.exception.frames.0.isVendor'))->toBeFalse()
        ->and($response->json('node.exception.frames.0.snippet.code'))->toContain("throw new RuntimeException('Expected Job failure.');")
        ->and($response->json('node.exception.frames.0.href'))->toStartWith('vscode://file/')
        ->and($response->json('node.exception.frames.1.isVendor'))->toBeTrue()
        ->and($response->json('node.exception.markdown'))->toContain('# RuntimeException - Job failed')
        ->toContain('## Stack Trace')
        ->toContain('PHP '.PHP_VERSION)
        ->toContain('Laravel '.app()->version())
        ->and($response->getContent())->not->toContain('/Users/')
        ->and($response->getContent())->not->toContain('exception.stacktrace');
});

it('enforces SQL, exception, frame, and metadata presentation bounds', function (): void {
    config()->set('skyline.privacy.sql_bytes', 32);
    config()->set('skyline.privacy.exception_message_bytes', 16);
    config()->set('skyline.privacy.metadata_string_bytes', 24);
    SqlJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', SqlJob::class)->first();
    $span = DB::table('skyline_spans')->where('role', 'sql')->first();
    $attributes = json_decode($span->attributes, true, flags: JSON_THROW_ON_ERROR);
    $attributes['db.query.text'] = str_repeat('select secret ', 10);
    $attributes['db.namespace'] = str_repeat('database-name', 10);
    DB::table('skyline_spans')->where('id', $span->id)->update([
        'attributes' => json_encode($attributes, JSON_THROW_ON_ERROR),
    ]);
    $trace = implode("\n", array_map(
        fn (int $frame): string => "#{$frame} /srv/product/app/Jobs/Secret.php(42): App\\Jobs\\Secret->handle(private-argument)",
        range(0, 100),
    ));
    DB::table('skyline_attempts')->where('run_id', $run->run_id)->update([
        'exception_class' => RuntimeException::class,
        'exception_message' => str_repeat('private-message', 4),
        'exception_file' => '/srv/product/app/Jobs/Secret.php',
        'exception_line' => 42,
        'exception_trace' => $trace,
    ]);

    $query = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.sql.isTruncated', true)
        ->assertJsonPath('node.sql.originalBytes', 140)
        ->assertJsonPath('node.metadata.isTruncated', true);
    $attempt = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/attempt_'.$run->run_id.'_1')
        ->assertOk()
        ->assertJsonPath('node.exception.messageTruncated', true)
        ->assertJsonPath('node.exception.framesTruncated', true)
        ->assertJsonCount(100, 'node.exception.frames')
        ->assertJsonPath('node.exception.frames.0.file', 'app/Jobs/Secret.php')
        ->assertJsonPath('node.exception.frames.0.function', 'handle')
        ->assertJsonPath('node.exception.frames.0.isVendor', false);

    expect($query->json('node.sql.value'))->toHaveLength(32)
        ->and($query->getContent())->not->toContain(str_repeat('database-name', 3))
        ->and($attempt->getContent())->not->toContain('private-argument')
        ->and($attempt->getContent())->not->toContain('/srv/product');
});

it('returns selected child subtrees and configured truncation signals', function (): void {
    config()->set('skyline.trace_node_limit', 2);
    config()->set('skyline.trace_poll_node_limit', 1);
    ParentJob::dispatchSync();
    $parent = DB::table('skyline_runs')->where('job_name', ParentJob::class)->first();
    $child = DB::table('skyline_runs')->where('job_name', ChildJob::class)->first();

    $this->getJson('/skyline/api/runs/'.$parent->run_id)
        ->assertOk()
        ->assertJsonPath('trace.nodeCount', 4)
        ->assertJsonPath('trace.isTruncated', true)
        ->assertJsonPath('trace.polling', false)
        ->assertJsonCount(2, 'trace.nodes');

    $this->getJson('/skyline/api/runs/'.$child->run_id)
        ->assertOk()
        ->assertJsonPath('run.id', $child->run_id)
        ->assertJsonPath('run.rootRunId', $parent->run_id)
        ->assertJsonPath('run.parentRunId', $parent->run_id)
        ->assertJsonPath('trace.nodeCount', 2)
        ->assertJsonPath('trace.nodes.0.parentId', null);
});

it('returns explicit missing responses', function (): void {
    $this->getJson('/skyline/api/runs/missing')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found');
});

it('uses the host Gate for JSON outside local environments', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');
    Gate::define('viewSkyline', fn ($user = null): bool => true);

    $this->getJson('/skyline/api/runs')->assertOk();
});

it('confines read failure details to logs', function (): void {
    $migration = require dirname(__DIR__, 2).'/database/migrations/2026_08_04_000000_create_skyline_telemetry_tables.php';
    $migration->down();

    $response = $this->getJson('/skyline/api/runs')
        ->assertStatus(500)
        ->assertJsonPath('error.code', 'read_failed');

    expect($response->json('error.correlationId'))->toBeString()
        ->and($response->getContent())->not->toContain('SQLSTATE')
        ->and($response->getContent())->not->toContain('skyline_runs');
});

function seedReadRun(
    int $index,
    string $status,
    bool $confirmed = true,
    ?string $job = null,
    string $connection = 'redis',
    string $queue = 'default',
): void {
    $traceId = sprintf('%032x', $index + 1);
    $runId = sprintf('run-%02d', $index);
    $triggeredAt = Nanoseconds::now() - ($index * 1_000_000_000);
    $confirmedAt = Nanoseconds::now();
    DB::table('skyline_traces')->insert([
        'trace_id' => $traceId,
        'root_run_id' => $runId,
        'revision' => 1,
        'last_activity_at' => $confirmedAt,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_runs')->insert([
        'run_id' => $runId,
        'trace_id' => $traceId,
        'job_name' => $job ?? sprintf('App\\Jobs\\Job%02d', $index),
        'connection' => $connection,
        'queue' => $queue,
        'status' => $status,
        'triggered_at' => $triggeredAt,
        'queued_at' => $triggeredAt + 1000,
        'started_at' => in_array($status, ['queued'], true) ? null : $triggeredAt + 2000,
        'finished_at' => in_array($status, ['completed', 'failed'], true) ? $triggeredAt + 3000 : null,
        'confirmed_at' => $confirmed ? $confirmedAt : null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}
