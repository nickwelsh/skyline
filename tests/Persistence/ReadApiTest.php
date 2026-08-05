<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use NickWelsh\Skyline\Read\EditorLink;
use NickWelsh\Skyline\Read\ExceptionPresenter;
use NickWelsh\Skyline\Read\Nanoseconds;
use NickWelsh\Skyline\Telemetry\SqlCapture;
use Tests\Fixtures\Jobs\CacheJob;
use Tests\Fixtures\Jobs\CacheStrategyJob;
use Tests\Fixtures\Jobs\ChildJob;
use Tests\Fixtures\Jobs\CustomTelemetryJob;
use Tests\Fixtures\Jobs\DeliveryJob;
use Tests\Fixtures\Jobs\FailingHttpJob;
use Tests\Fixtures\Jobs\FailingJob;
use Tests\Fixtures\Jobs\HttpJob;
use Tests\Fixtures\Jobs\ParentJob;
use Tests\Fixtures\Jobs\ProcessDetailJob;
use Tests\Fixtures\Jobs\RedisJob;
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

it('exposes the versioned Runs contract and filters by Trace and root identity', function (): void {
    seedReadRun(1, 'completed', true, 'App\\Jobs\\Parent');
    $traceId = sprintf('%032x', 2);
    $triggeredAt = Nanoseconds::now();
    DB::table('skyline_runs')->insert([
        'run_id' => 'run-child',
        'trace_id' => $traceId,
        'parent_run_id' => 'run-01',
        'job_name' => 'App\\Jobs\\Child',
        'connection' => 'redis',
        'queue' => 'default',
        'status' => 'running',
        'triggered_at' => $triggeredAt,
        'queued_at' => $triggeredAt,
        'started_at' => $triggeredAt,
        'confirmed_at' => $triggeredAt,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->getJson('/skyline/api/runs?'.http_build_query([
        'trace' => $traceId,
        'rootOnly' => 'false',
    ]))->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('capabilities.runs.view', true)
        ->assertJsonPath('capabilities.runs.cancel', false)
        ->assertJsonPath('filters.trace', $traceId)
        ->assertJsonPath('filters.rootOnly', false)
        ->assertJsonPath('runs.0.traceId', $traceId)
        ->assertJsonPath('runs.0.isRoot', false)
        ->assertJsonPath('runs.1.isRoot', true)
        ->assertJsonPath('options.traceIdentities.0', $traceId);

    expect($response->json('generatedAt'))->toEndWith('Z')
        ->and($response->json('runs.0.triggeredAt'))->toEndWith('Z')
        ->and($response->json('runs.0.activeDurationUs'))->toBeInt();

    $this->getJson('/skyline/api/runs?'.http_build_query([
        'trace' => $traceId,
        'rootOnly' => 'true',
    ]))->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.id', 'run-01');

    $this->getJson('/skyline/api/runs?rootOnly=maybe')
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
    config()->set('app.editor', 'phpstorm');
    SqlJob::dispatchSync('private-job-payload');
    $run = DB::table('skyline_runs')->where('job_name', SqlJob::class)->first();
    $span = DB::table('skyline_spans')->where('role', 'sql')->first();

    $trace = $this->getJson('/skyline/api/runs/'.$run->run_id)
        ->assertOk()
        ->assertJsonPath('run.id', $run->run_id)
        ->assertJsonPath('run.queueTarget.connection', 'sync')
        ->assertJsonPath('run.driverId', $run->driver_id)
        ->assertJsonPath('run.queueTimeSource', $run->queue_time_source)
        ->assertJsonPath('attempts.0.number', 1)
        ->assertJsonPath('attempts.0.inspectorHref', '/skyline/api/runs/'.$run->run_id.'/nodes/attempt_'.$run->run_id.'_1')
        ->assertJsonPath('relationships.parent', null)
        ->assertJsonPath('trace.nodes.0.id', 'run_'.$run->run_id)
        ->assertJsonPath('trace.nodes.0.inspectorHref', '/skyline/api/runs/'.$run->run_id.'/nodes/run_'.$run->run_id)
        ->assertJsonPath('trace.nodes.0.kind', 'run')
        ->assertJsonPath('trace.nodes.1.kind', 'attempt')
        ->assertJsonPath('trace.nodes.2.kind', 'query')
        ->assertJsonPath('trace.nodes.2.telemetryEventHref', '/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id);
    $etag = $trace->headers->get('ETag');

    expect($trace->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');

    $job = new ReflectionClass(SqlJob::class);
    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/run_'.$run->run_id)
        ->assertOk()
        ->assertJsonPath('node.source.file', 'tests/Fixtures/Jobs/SqlJob.php')
        ->assertJsonPath('node.source.line', $job->getStartLine())
        ->assertJsonPath('node.source.href', 'phpstorm://open?file='.$job->getFileName().'&line='.$job->getStartLine());

    $this->withHeader('If-None-Match', $etag)
        ->get('/skyline/api/runs/'.$run->run_id)
        ->assertStatus(304)
        ->assertHeader('ETag', $etag);

    $inspector = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.kind', 'query')
        ->assertJsonPath('node.presentation.type', 'generic')
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

it('projects ordered Attempt failures and causal Run relationships', function (): void {
    ParentJob::dispatchSync();
    $parent = DB::table('skyline_runs')->where('job_name', ParentJob::class)->first();
    $child = DB::table('skyline_runs')->where('job_name', ChildJob::class)->first();

    DB::table('skyline_attempts')->where('run_id', $parent->run_id)->where('attempt_number', 1)->update([
        'status' => 'failed',
        'exception_class' => 'RuntimeException',
        'exception_message' => 'First try failed',
    ]);

    $response = $this->getJson('/skyline/api/runs/'.$parent->run_id)
        ->assertOk()
        ->assertJsonPath('attempts.0.number', 1)
        ->assertJsonPath('attempts.0.failure.class', 'RuntimeException')
        ->assertJsonPath('attempts.0.failure.message', 'First try failed')
        ->assertJsonPath('relationships.children.0.id', $child->run_id)
        ->assertJsonPath('relationships.children.0.parentRunId', $parent->run_id)
        ->assertJsonPath('relationships.children.0.inspectorHref', '/skyline/api/runs/'.$parent->run_id.'/nodes/run_'.$child->run_id);

    expect(collect($response->json('attempts'))->pluck('number')->all())->toBe([1]);
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
        ->assertJsonPath('node.presentation.type', 'http')
        ->assertJsonPath('node.presentation.http.method', 'POST')
        ->assertJsonPath('node.presentation.failure', null)
        ->assertJsonPath('node.http.method', 'POST')
        ->assertJsonPath('node.http.url', 'https://api.example.test/people?token=%5BREDACTED%5D')
        ->assertJsonPath('node.http.statusCode', 201)
        ->assertJsonPath('node.http.request.headers.items.Authorization.0', '[REDACTED]')
        ->assertJsonPath('node.http.request.body.json.name', 'Laravel')
        ->assertJsonPath('node.http.response.headers.items.Set-Cookie.0', '[REDACTED]')
        ->assertJsonPath('node.http.response.body.json.id', 42)
        ->assertJsonPath('node.source.file', 'tests/Fixtures/Jobs/HttpJob.php');

    expect($inspector->json('node.presentation.timing.startedAt'))->toEndWith('Z')
        ->and($inspector->json('node.presentation.timing.durationUs'))->toBeInt()->toBeGreaterThanOrEqual(0);

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
    config()->set('skyline.storage.capture_contents', true);
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
        ->assertJsonPath('node.presentation.type', 'storage')
        ->assertJsonPath('node.presentation.storage.operation', 'write')
        ->assertJsonPath('node.storage.operation', 'write')
        ->assertJsonPath('node.storage.path', 'reports/customer report.txt')
        ->assertJsonPath('node.storage.pathCaptured', true)
        ->assertJsonPath('node.storage.url', 'https://files.example.test/reports/customer%20report.txt')
        ->assertJsonPath('node.storage.localFile.path', $root.'/reports/customer report.txt')
        ->assertJsonPath('node.storage.localFile.href', 'vscode://file/'.$root.'/reports/customer report.txt:1')
        ->assertJsonPath('node.storage.content.value', 'private contents')
        ->assertJsonPath('node.storage.outcome', 'completed');
});

it('serves captured cache values and delivery content', function (): void {
    config()->set('skyline.cache.capture_keys', true);
    config()->set('skyline.cache.capture_values', true);
    CacheJob::dispatchSync();
    $cacheRun = DB::table('skyline_runs')->where('job_name', CacheJob::class)->first();
    $cacheSpan = DB::table('skyline_spans')
        ->where('run_id', $cacheRun->run_id)
        ->where('role', 'cache')
        ->where('attributes', 'like', '%"cache.operation":"PUT"%')
        ->first();

    $this->getJson('/skyline/api/runs/'.$cacheRun->run_id.'/nodes/span_'.$cacheSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.cache.key', 'customer:secret@example.test')
        ->assertJsonPath('node.cache.value.type', 'string')
        ->assertJsonPath('node.cache.value.value', 'private-value')
        ->assertJsonPath('node.cache.value.truncated', false);

    config()->set('mail.default', 'array');
    config()->set('mail.mailers.array', ['transport' => 'array']);
    config()->set('skyline.delivery.capture_recipients', true);
    config()->set('skyline.delivery.capture_content', true);
    DeliveryJob::dispatchSync();
    $deliveryRun = DB::table('skyline_runs')->where('job_name', DeliveryJob::class)->first();
    $mailSpan = DB::table('skyline_spans')
        ->where('run_id', $deliveryRun->run_id)
        ->where('role', 'mail')
        ->where('attributes', 'like', '%private subject%')
        ->first();
    $notificationSpan = DB::table('skyline_spans')
        ->where('run_id', $deliveryRun->run_id)
        ->where('role', 'notification')
        ->where('name', 'Notification slack')
        ->first();

    $this->getJson('/skyline/api/runs/'.$deliveryRun->run_id.'/nodes/span_'.$mailSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'delivery')
        ->assertJsonPath('node.presentation.delivery.kind', 'mail')
        ->assertJsonPath('node.delivery.recipients.0.address', 'first@example.test')
        ->assertJsonPath('node.delivery.subject.value', 'private subject')
        ->assertJsonPath('node.delivery.html.value', '<p>private body</p>');

    $this->getJson('/skyline/api/runs/'.$deliveryRun->run_id.'/nodes/span_'.$notificationSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'delivery')
        ->assertJsonPath('node.presentation.delivery.kind', 'notification')
        ->assertJsonPath('node.delivery.recipientIdentity.value.type', 'stdClass')
        ->assertJsonPath('node.delivery.operationData.value.route', 'private-route');
});

it('serves captured process command environment input and output', function (): void {
    config()->set('skyline.process.capture_command', true);
    config()->set('skyline.process.capture_environment', true);
    config()->set('skyline.process.capture_input', true);
    config()->set('skyline.process.capture_output', true);
    ProcessDetailJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', ProcessDetailJob::class)->first();
    $span = DB::table('skyline_spans')->where('run_id', $run->run_id)->where('role', 'process')->first();

    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'process')
        ->assertJsonPath('node.presentation.process.executable', basename(PHP_BINARY))
        ->assertJsonPath('node.process.command.value.1', '-r')
        ->assertJsonPath('node.process.environment.value.SKYLINE_PRIVATE_ENV', 'private environment')
        ->assertJsonPath('node.process.input.value', 'private input')
        ->assertJsonPath('node.process.stdout.value', 'private environment / private input')
        ->assertJsonPath('node.process.stderr.value', 'private error');

    $attributes = json_decode($span->attributes, true, flags: JSON_THROW_ON_ERROR);
    unset($attributes['process.async'], $attributes['process.timed_out']);
    DB::table('skyline_spans')->where('id', $span->id)->update([
        'attributes' => json_encode($attributes, JSON_THROW_ON_ERROR),
    ]);

    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.process.async', null)
        ->assertJsonPath('node.presentation.process.timedOut', null);
});

it('serves captured direct Redis command arguments', function (): void {
    config()->set('skyline.redis.capture_arguments', true);
    RedisJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', RedisJob::class)->first();
    $span = DB::table('skyline_spans')->where('run_id', $run->run_id)->where('role', 'redis')->first();

    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.redis.arguments.value.0', 'private-key')
        ->assertJsonPath('node.redis.arguments.value.1', 'private-value');
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
        ->assertJsonPath('node.presentation.type', 'breadcrumb')
        ->assertJsonPath('node.presentation.breadcrumb.message', 'Import token=[REDACTED] delayed')
        ->assertJsonPath('node.breadcrumb.level', 'warning')
        ->assertJsonPath('node.breadcrumb.channel', 'stack')
        ->assertJsonPath('node.breadcrumb.message', 'Import token=[REDACTED] delayed')
        ->assertJsonPath('node.breadcrumb.context.code', 429)
        ->assertJsonMissingPath('node.breadcrumb.context.password');
});

it('discriminates custom and summary inspector presentations', function (): void {
    CustomTelemetryJob::dispatchSync();
    $customRun = DB::table('skyline_runs')->where('job_name', CustomTelemetryJob::class)->first();
    $customSpan = DB::table('skyline_spans')
        ->where('run_id', $customRun->run_id)
        ->where('role', 'custom')
        ->where('name', 'Upload PDF')
        ->first();

    $this->getJson('/skyline/api/runs/'.$customRun->run_id.'/nodes/span_'.$customSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'custom')
        ->assertJsonPath('node.presentation.custom.name', 'Upload PDF')
        ->assertJsonPath('node.presentation.custom.attributes.bytes', 512);

    SummaryJob::dispatchSync();
    $summaryRun = DB::table('skyline_runs')->where('job_name', SummaryJob::class)->first();
    $attempt = DB::table('skyline_attempts')->where('run_id', $summaryRun->run_id)->first();

    $this->getJson('/skyline/api/runs/'.$summaryRun->run_id.'/nodes/attempt_'.$summaryRun->run_id.'_'.$attempt->attempt_number)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'summary')
        ->assertJsonPath('node.presentation.summary.operations.sql.count', 1)
        ->assertJsonPath('node.presentation.summary.operations.cache.count', 1)
        ->assertJsonPath('node.presentation.summary.operations.custom.count', 1);
});

it('preserves captured operation failures in the discriminated presentation', function (): void {
    FailingHttpJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', FailingHttpJob::class)->first();
    $span = DB::table('skyline_spans')->where('run_id', $run->run_id)->where('role', 'http')->first();

    $response = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'http')
        ->assertJsonPath('node.presentation.failure.type', 'GuzzleHttp\\Exception\\RequestException');

    expect($response->json('node.presentation.failure.message'))->toBe('HTTP request failed')
        ->and($response->json('node.presentation.http.response.headers'))->toBeNull()
        ->and($response->json('node.presentation.http.response.body'))->toBeNull();
});

it('falls back to generic presentation for recorded telemetry without a specialized presenter', function (): void {
    CustomTelemetryJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', CustomTelemetryJob::class)->first();
    $span = DB::table('skyline_spans')
        ->where('run_id', $run->run_id)
        ->where('role', 'custom')
        ->where('name', 'Generate PDF')
        ->first();
    DB::table('skyline_spans')->where('id', $span->id)->update(['role' => 'framework']);

    $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.kind', 'framework')
        ->assertJsonPath('node.presentation.type', 'generic')
        ->assertJsonPath('node.presentation.timing.durationUs', fn (mixed $duration): bool => is_int($duration) && $duration >= 0);
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
        ->and($response->json('node.exception.frames.0.href'))->toBeNull()
        ->and($response->json('node.exception.frames.1.isVendor'))->toBeTrue()
        ->and($response->json('node.exception.markdown'))->toContain('# RuntimeException - Job failed')
        ->toContain('## Stack Trace')
        ->toContain('Run '.$run->run_id)
        ->toContain('Attempt '.(int) $attempt->attempt_number)
        ->and($response->json('node.exception'))->not->toHaveKey('runtime')
        ->and($response->getContent())->not->toContain(str_replace('/', '\\/', base_path()))
        ->and($response->getContent())->not->toContain('exception.stacktrace');

    config()->set('app.editor', [
        'name' => 'vscode',
        'base_path' => '/workspace/skyline',
    ]);

    $mappedFile = base_path('composer.json');
    $mappedAttempt = (object) [
        ...(array) $attempt,
        'exception_file' => $mappedFile,
        'exception_line' => 1,
        'exception_trace' => "#0 {$mappedFile}(1): App\\Jobs\\FailingJob->handle()",
    ];
    $linked = (new ExceptionPresenter(app(EditorLink::class)))
        ->present($mappedAttempt, FailingJob::class);

    expect($linked['frames'][0]['href'])
        ->toStartWith('vscode://file//workspace/skyline/')
        ->not->toContain(base_path());
});

it('keeps failed Attempt evidence distinct without inventing uncaptured metadata', function (): void {
    seedReadRun(71, 'failed', true, 'App\\Jobs\\RetriedFailure');
    $runId = 'run-71';
    $startedAt = Nanoseconds::now();

    foreach ([
        [
            'attempt_number' => 1,
            'exception_class' => RuntimeException::class,
            'exception_message' => 'First failure.',
            'exception_code' => '41',
            'exception_file' => '/srv/product/app/Jobs/RetriedFailure.php',
            'exception_line' => 12,
            'exception_trace' => "#0 /srv/product/app/Jobs/RetriedFailure.php(12): App\\Jobs\\RetriedFailure->firstAttempt(private-value)\n#1 /srv/product/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(99): Illuminate\\Queue\\Worker->process()",
        ],
        [
            'attempt_number' => 2,
            'exception_class' => LogicException::class,
            'exception_message' => 'Second failure.',
            'exception_code' => null,
            'exception_file' => '/srv/product/app/Jobs/RetriedFailure.php',
            'exception_line' => 22,
            'exception_trace' => '#0 /srv/product/app/Jobs/RetriedFailure.php(22): App\\Jobs\\RetriedFailure->secondAttempt()',
        ],
        [
            'attempt_number' => 3,
            'exception_class' => RuntimeException::class,
            'exception_message' => 'Metadata unavailable.',
            'exception_code' => null,
            'exception_file' => null,
            'exception_line' => null,
            'exception_trace' => null,
        ],
    ] as $failure) {
        DB::table('skyline_attempts')->insert([
            'run_id' => $runId,
            'status' => 'failed',
            'started_at' => $startedAt + $failure['attempt_number'],
            'finished_at' => $startedAt + $failure['attempt_number'] + 1,
            'queue_time_ns' => null,
            'queue_time_source' => null,
            ...$failure,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $first = $this->getJson("/skyline/api/runs/{$runId}/nodes/attempt_{$runId}_1")->assertOk();
    $second = $this->getJson("/skyline/api/runs/{$runId}/nodes/attempt_{$runId}_2")->assertOk();
    $unavailable = $this->getJson("/skyline/api/runs/{$runId}/nodes/attempt_{$runId}_3")
        ->assertOk()
        ->assertJsonPath('node.overview.runId', $runId)
        ->assertJsonPath('node.overview.attemptNumber', 3)
        ->assertJsonPath('node.exception.location', null)
        ->assertJsonCount(0, 'node.exception.frames');

    expect($first->json('node.exception'))
        ->toMatchArray([
            'class' => RuntimeException::class,
            'message' => 'First failure.',
            'code' => '41',
            'location' => ['file' => 'app/Jobs/RetriedFailure.php', 'line' => 12, 'href' => null],
        ])
        ->not->toBe($second->json('node.exception'))
        ->and($second->json('node.exception'))
        ->toMatchArray([
            'class' => LogicException::class,
            'message' => 'Second failure.',
            'location' => ['file' => 'app/Jobs/RetriedFailure.php', 'line' => 22, 'href' => null],
        ])
        ->and($first->json('node.exception.markdown'))
        ->toContain('Run run-71')
        ->toContain('Attempt 1')
        ->and($unavailable->json('node.exception'))
        ->not->toHaveKey('runtime')
        ->and($unavailable->getContent())
        ->not->toContain('/srv/product')
        ->not->toContain('private-value');
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
