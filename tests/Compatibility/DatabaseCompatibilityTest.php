<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use NickWelsh\Skyline\Read\Nanoseconds;
use Tests\Fixtures\Jobs\SqlJob;
use Tests\Fixtures\Jobs\SummaryJob;

it('migrates and persists a complete parameterized trace on the configured SQL engine', function (): void {
    SqlJob::dispatchSync('private-job-payload');
    $attributes = DB::table('skyline_spans')->where('role', 'sql')->value('attributes');

    expect(Schema::hasTable('skyline_traces'))->toBeTrue()
        ->and(Schema::hasTable('skyline_runs'))->toBeTrue()
        ->and(Schema::hasTable('skyline_attempts'))->toBeTrue()
        ->and(Schema::hasTable('skyline_spans'))->toBeTrue()
        ->and(DB::table('skyline_traces')->count())->toBe(1)
        ->and(DB::table('skyline_runs')->value('status'))->toBe('completed')
        ->and(DB::table('skyline_attempts')->value('status'))->toBe('completed')
        ->and(DB::table('skyline_spans')->count())->toBe(3)
        ->and($attributes)->toContain('select ? as private_value')
        ->toContain('skyline.sql.bindings')
        ->toContain('skyline.sql.result')
        ->toContain('do-not-capture')
        ->not->toContain('private-job-payload');
});

it('backfills normalized Telemetry events when an existing install runs the new migration', function (): void {
    config()->set('skyline.logging.enabled', true);
    config()->set('skyline.logging.levels', ['warning', 'error']);
    config()->set('skyline.logging.context_allowlist', ['code', 'status']);
    SummaryJob::dispatchSync();

    $migration = require dirname(__DIR__, 2).'/database/migrations/2026_08_05_000000_create_skyline_telemetry_events_table.php';
    $migration->down();

    expect(Schema::hasTable('skyline_telemetry_events'))->toBeFalse()
        ->and(DB::table('skyline_spans')->count())->toBeGreaterThan(1);

    $migration->up();
    $events = DB::table('skyline_telemetry_events')->orderBy('occurred_at')->get();

    expect(Schema::hasTable('skyline_telemetry_events'))->toBeTrue()
        ->and($events->where('variant', 'operation'))->not->toBeEmpty()
        ->and($events->where('variant', 'log'))->toHaveCount(2)
        ->and($events->where('variant', 'log')->pluck('message')->implode(' '))->toContain('[REDACTED]')
        ->not->toContain('private-token')
        ->not->toContain('private-password');
});

it('searches Runs with literal SQL wildcards on the configured SQL engine', function (): void {
    $now = Nanoseconds::now();

    foreach (['App\\Jobs\\Invoice_100%', 'App\\Jobs\\InvoiceA100B'] as $index => $jobName) {
        $runId = 'compatibility-search-run-'.$index;
        $traceId = sprintf('%032x', $index + 1);
        DB::table('skyline_traces')->insert([
            'trace_id' => $traceId,
            'root_run_id' => $runId,
            'revision' => 1,
            'last_activity_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('skyline_runs')->insert([
            'run_id' => $runId,
            'trace_id' => $traceId,
            'job_name' => $jobName,
            'connection' => 'redis',
            'queue' => 'default',
            'status' => 'completed',
            'triggered_at' => $now - $index,
            'queued_at' => $now - $index,
            'started_at' => $now - $index,
            'finished_at' => $now - $index,
            'confirmed_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $this->getJson('/skyline/api/runs?'.http_build_query(['search' => '_100%']))
        ->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.name', 'App\\Jobs\\Invoice_100%');
});

it('aggregates Job summaries and activity on the configured SQL engine', function (): void {
    $now = Nanoseconds::now();

    foreach ([['completed', $now - 3_600_000_000_000], ['failed', $now - 1_000_000_000]] as $index => [$status, $triggeredAt]) {
        $runId = 'compatibility-job-run-'.$index;
        $traceId = sprintf('%032x', $index + 100);
        DB::table('skyline_traces')->insert([
            'trace_id' => $traceId,
            'root_run_id' => $runId,
            'revision' => 1,
            'last_activity_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('skyline_runs')->insert([
            'run_id' => $runId,
            'trace_id' => $traceId,
            'job_name' => 'App\\Jobs\\Compatibility',
            'connection' => 'redis',
            'queue' => 'default',
            'status' => $status,
            'triggered_at' => $triggeredAt,
            'queued_at' => $triggeredAt,
            'started_at' => $triggeredAt,
            'finished_at' => $triggeredAt + 1_000_000,
            'confirmed_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $response = $this->getJson('/skyline/api/jobs')->assertOk()
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Compatibility')
        ->assertJsonPath('jobs.0.runCount', 2)
        ->assertJsonPath('jobs.0.statusCounts.completed', 1)
        ->assertJsonPath('jobs.0.statusCounts.failed', 1);

    expect(array_sum(array_column($response->json('jobs.0.activity'), 'total')))->toBe(2);

    $this->getJson('/skyline/api/jobs/'.$response->json('jobs.0.id').'?period=all')->assertOk()
        ->assertJsonPath('job.runCount', 2)
        ->assertJsonPath('job.latestRun.id', 'compatibility-job-run-1')
        ->assertJsonPath('queueTargets.0.runCount', 2)
        ->assertJsonCount(2, 'runs');
});
