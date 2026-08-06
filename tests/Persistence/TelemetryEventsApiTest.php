<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;

it('projects a versioned time-ordered Telemetry-event union with stable causal identities', function (): void {
    seedTelemetryEventRun();

    $response = $this->getJson('/skyline/api/logs')->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('capabilities.navigation.logs', true)
        ->assertJsonCount(3, 'telemetryEvents');

    expect($response->json('telemetryEvents.*.variant'))->toBe(['log', 'operation', 'log'])
        ->and($response->json('telemetryEvents.0'))->toMatchArray([
            'runId' => 'telemetry-run-1',
            'attemptNumber' => 1,
            'jobType' => 'App\\Jobs\\TelemetryJob',
            'traceId' => '000000000000000000000000000000a1',
            'spanId' => '00000000000000b1',
            'parentSpanId' => null,
            'level' => 'ERROR',
            'message' => 'Import failed',
            'context' => ['code' => 500],
        ])
        ->and($response->json('telemetryEvents.1'))->toMatchArray([
            'runId' => 'telemetry-run-1',
            'attemptNumber' => 1,
            'jobType' => 'App\\Jobs\\TelemetryJob',
            'traceId' => '000000000000000000000000000000a1',
            'spanId' => '00000000000000c1',
            'parentSpanId' => '00000000000000b1',
            'level' => 'TRACE',
            'name' => 'Generate PDF',
            'role' => 'custom',
            'kind' => 1,
            'status' => 'completed',
            'durationUs' => 250,
        ])
        ->and($response->json('telemetryEvents.0.id'))->toStartWith('event_')->not->toContain('00000000000000b1')
        ->and($response->json('telemetryEvents.0.href'))->toBe('/skyline/logs?event='.$response->json('telemetryEvents.0.id'))
        ->and($response->json('telemetryEvents.1.operationHref'))->toBe('/skyline/runs/telemetry-run-1?node=span_00000000000000c1')
        ->and($response->json('telemetryEvents.1.runHref'))->toBe('/skyline/runs/telemetry-run-1')
        ->and($response->json('telemetryEvents.1.attemptHref'))->toBe('/skyline/runs/telemetry-run-1?node=attempt_telemetry-run-1_1')
        ->and($response->json('telemetryEvents.1.jobHref'))->toStartWith('/skyline/jobs/job_');

    expect($this->getJson('/skyline/api/logs')->json('telemetryEvents.*.id'))
        ->toBe($response->json('telemetryEvents.*.id'));
});

it('shows captured operation detail, causal links, and honest capture boundaries', function (): void {
    config()->set('skyline.logging.enabled', true);
    config()->set('skyline.logging.levels', ['warning', 'error', 'critical']);
    config()->set('skyline.logging.max_breadcrumbs', 7);
    config()->set('skyline.privacy.metadata_string_bytes', 12);
    seedTelemetryEventRun();

    $page = $this->getJson('/skyline/api/logs')->assertOk()
        ->assertJsonPath('capture.enabled', true)
        ->assertJsonPath('capture.supportedLevels', ['warning', 'error', 'critical'])
        ->assertJsonPath('capture.perAttemptLimit', 7);
    $operation = collect($page->json('telemetryEvents'))->firstWhere('variant', 'operation');

    $detail = $this->getJson('/skyline/api/logs/'.$operation['id'])->assertOk()
        ->assertJsonPath('telemetryEvent.id', $operation['id'])
        ->assertJsonPath('telemetryEvent.relationships.traceId', '000000000000000000000000000000a1')
        ->assertJsonPath('telemetryEvent.relationships.spanId', '00000000000000c1')
        ->assertJsonPath('telemetryEvent.relationships.parentSpanId', '00000000000000b1')
        ->assertJsonPath('telemetryEvent.events.0.name', 'pdf.rendered')
        ->assertJsonPath('telemetryEvent.links.0.traceId', '000000000000000000000000000000d1')
        ->assertJsonPath('telemetryEvent.capture.isTruncated', true);

    expect($detail->json('telemetryEvent.attributes')['db.namespace'])->toBe('billing-data')
        ->and($detail->json('telemetryEvent.resource')['service.name'])->toBe('worker')
        ->and($detail->getContent())->not->toContain('private-secret')
        ->and($detail->json('telemetryEvent.capture.truncated'))->not->toBeEmpty()
        ->and($detail->json('telemetryEvent.errorHref'))->toBeNull();

    $log = collect($page->json('telemetryEvents'))->firstWhere('variant', 'log');
    $this->getJson('/skyline/api/logs/'.$log['id'])->assertOk()
        ->assertJsonPath('telemetryEvent.message', $log['message'])
        ->assertJsonPath('telemetryEvent.context', $log['context'])
        ->assertJsonMissingPath('telemetryEvent.messageTruncated');

    $this->getJson('/skyline/api/logs/event_missing')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found');
});

it('filters and cursor-paginates Telemetry events through server-supplied URL options', function (): void {
    $now = Nanoseconds::now();
    for ($index = 0; $index < 27; $index++) {
        seedTelemetryOperation(
            $index,
            $index % 2 === 0 ? 'App\\Jobs\\Invoice' : 'App\\Jobs\\Digest',
            $index % 3 === 0 ? 'ERROR' : 'OK',
            $now - ($index * 1_000_000_000),
        );
    }

    $filtered = $this->getJson('/skyline/api/logs?'.http_build_query([
        'levels' => ['ERROR'],
        'jobType' => 'App\\Jobs\\Invoice',
        'runId' => 'telemetry-filter-00',
        'period' => '7d',
    ]))->assertOk()
        ->assertJsonCount(1, 'telemetryEvents')
        ->assertJsonPath('telemetryEvents.0.runId', 'telemetry-filter-00')
        ->assertJsonPath('filters.levels', ['ERROR'])
        ->assertJsonPath('filters.jobType', 'App\\Jobs\\Invoice')
        ->assertJsonPath('filters.runId', 'telemetry-filter-00')
        ->assertJsonPath('filters.period', '7d')
        ->assertJsonPath('hasAnyTelemetryEvents', true);

    expect($filtered->json('options.levels'))->toBe(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'])
        ->and($filtered->json('options.jobTypes'))->toBe(['App\\Jobs\\Digest', 'App\\Jobs\\Invoice'])
        ->and(collect($filtered->json('options.timeRanges'))->pluck('value')->all())->toBe(['1h', '24h', '7d', '30d', 'all']);

    $errorHref = $this->getJson('/skyline/api/logs/'.$filtered->json('telemetryEvents.0.id'))
        ->assertOk()->json('telemetryEvent.errorHref');
    expect($errorHref)->toStartWith('/skyline/errors/error_');
    $this->getJson(str_replace('/skyline/errors/', '/skyline/api/errors/', $errorHref))->assertOk();

    $first = $this->getJson('/skyline/api/logs')->assertOk()
        ->assertJsonCount(25, 'telemetryEvents')
        ->assertJsonPath('pagination.previous', null);
    $next = $first->json('pagination.next');
    expect($next)->toBeString()->not->toContain('telemetry-filter');

    $second = $this->getJson('/skyline/api/logs?'.http_build_query(['cursor' => $next]))
        ->assertOk()->assertJsonCount(2, 'telemetryEvents')
        ->assertJsonPath('pagination.next', null);
    $previous = $second->json('pagination.previous');

    expect($previous)->toBeString()
        ->and($this->getJson('/skyline/api/logs?'.http_build_query(['cursor' => $previous]))
            ->assertOk()->json('telemetryEvents'))->toBe($first->json('telemetryEvents'));

    $this->getJson('/skyline/api/logs?'.http_build_query(['levels' => ['WARN'], 'cursor' => $next]))
        ->assertStatus(422)->assertJsonPath('error.code', 'invalid_query');
    $this->getJson('/skyline/api/logs?levels[]=VERBOSE')
        ->assertStatus(422)->assertJsonPath('error.code', 'invalid_query');
});

it('distinguishes initial and filtered-empty Telemetry-event pages', function (): void {
    $this->getJson('/skyline/api/logs')->assertOk()
        ->assertJsonCount(0, 'telemetryEvents')
        ->assertJsonPath('hasAnyTelemetryEvents', false);

    seedTelemetryOperation(90, 'App\\Jobs\\Invoice', 'OK', Nanoseconds::now());
    $this->getJson('/skyline/api/logs?jobType=App%5CJobs%5CMissing')->assertOk()
        ->assertJsonCount(0, 'telemetryEvents')
        ->assertJsonPath('hasAnyTelemetryEvents', true);
});

function seedTelemetryEventRun(): void
{
    $now = 1_786_000_000_000_000_000;
    DB::table('skyline_traces')->insert([
        'trace_id' => '000000000000000000000000000000a1',
        'root_run_id' => 'telemetry-run-1',
        'revision' => 1,
        'last_activity_at' => $now + 3_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_runs')->insert([
        'run_id' => 'telemetry-run-1',
        'trace_id' => '000000000000000000000000000000a1',
        'job_name' => 'App\\Jobs\\TelemetryJob',
        'connection' => 'redis',
        'queue' => 'default',
        'status' => 'completed',
        'triggered_at' => $now,
        'queued_at' => $now,
        'started_at' => $now,
        'finished_at' => $now + 3_000_000,
        'confirmed_at' => $now + 3_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_attempts')->insert([
        'run_id' => 'telemetry-run-1',
        'attempt_number' => 1,
        'status' => 'completed',
        'started_at' => $now,
        'finished_at' => $now + 3_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_spans')->insert([
        [
            'trace_id' => '000000000000000000000000000000a1',
            'run_id' => 'telemetry-run-1',
            'attempt_number' => 1,
            'span_id' => '00000000000000b1',
            'parent_span_id' => null,
            'name' => 'App\\Jobs\\TelemetryJob',
            'role' => 'consumer',
            'kind' => 5,
            'status_code' => 'OK',
            'started_at' => $now,
            'ended_at' => $now + 3_000_000,
            'attributes' => '{}',
            'events' => json_encode([
                ['name' => 'log', 'timestamp' => $now + 1_000_000, 'attributes' => ['log.level' => 'warning', 'log.message' => 'Import started', 'log.context' => '{"code":100}']],
                ['name' => 'log', 'timestamp' => $now + 3_000_000, 'attributes' => ['log.level' => 'error', 'log.message' => 'Import failed', 'log.context' => '{"code":500}']],
            ], JSON_THROW_ON_ERROR),
            'links' => '[]',
            'resource_attributes' => '{}',
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'trace_id' => '000000000000000000000000000000a1',
            'run_id' => 'telemetry-run-1',
            'attempt_number' => 1,
            'span_id' => '00000000000000c1',
            'parent_span_id' => '00000000000000b1',
            'name' => 'Generate PDF',
            'role' => 'custom',
            'kind' => 1,
            'status_code' => 'OK',
            'started_at' => $now + 2_000_000,
            'ended_at' => $now + 2_250_000,
            'attributes' => '{"skyline.role":"custom","db.namespace":"billing-database","secret":"private-secret"}',
            'events' => '[{"name":"pdf.rendered","timestamp":1786000000002100000,"attributes":{"db.row_count":12,"secret":"private-secret"}}]',
            'links' => '[{"trace_id":"000000000000000000000000000000d1","span_id":"00000000000000d2","trace_flags":1,"remote":true,"attributes":{"db.link":"invoice","secret":"private-secret"}}]',
            'resource_attributes' => '{"service.name":"worker"}',
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);
}

function seedTelemetryOperation(int $index, string $jobType, string $status, int $startedAt): void
{
    $traceId = sprintf('%032x', 50_000 + $index);
    $spanId = sprintf('%016x', 60_000 + $index);
    $runId = sprintf('telemetry-filter-%02d', $index);
    DB::table('skyline_traces')->insert([
        'trace_id' => $traceId,
        'root_run_id' => $runId,
        'revision' => 1,
        'last_activity_at' => $startedAt + 1_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_runs')->insert([
        'run_id' => $runId,
        'trace_id' => $traceId,
        'job_name' => $jobType,
        'connection' => 'redis',
        'queue' => 'default',
        'status' => $status === 'ERROR' ? 'failed' : 'completed',
        'triggered_at' => $startedAt,
        'started_at' => $startedAt,
        'finished_at' => $startedAt + 1_000_000,
        'confirmed_at' => $startedAt + 1_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_attempts')->insert([
        'run_id' => $runId,
        'attempt_number' => 1,
        'status' => $status === 'ERROR' ? 'failed' : 'completed',
        'started_at' => $startedAt,
        'finished_at' => $startedAt + 1_000_000,
        'exception_class' => $status === 'ERROR' ? 'RuntimeException' : null,
        'exception_message' => $status === 'ERROR' ? 'Telemetry operation failed' : null,
        'exception_file' => $status === 'ERROR' ? '/srv/app/Jobs/TelemetryJob.php' : null,
        'exception_line' => $status === 'ERROR' ? 42 : null,
        'exception_trace' => $status === 'ERROR' ? '#0 /srv/app/Jobs/TelemetryJob.php(42): App\\Jobs\\TelemetryJob->handle()' : null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_spans')->insert([
        'trace_id' => $traceId,
        'run_id' => $runId,
        'attempt_number' => 1,
        'span_id' => $spanId,
        'name' => 'HTTP GET',
        'role' => 'http',
        'kind' => 3,
        'status_code' => $status,
        'started_at' => $startedAt,
        'ended_at' => $startedAt + 1_000_000,
        'attributes' => '{"http.request.method":"GET","url.full":"https://example.test"}',
        'events' => '[]',
        'links' => '[]',
        'resource_attributes' => '{}',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}
