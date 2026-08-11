<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;
use Tests\Fixtures\Jobs\InspectableJob;

it('lists observed Job types with opaque identities and truthful summaries', function (): void {
    seedJobRun(1, 'App\\Jobs\\Invoice', 'completed', true, 'redis', 'billing');
    seedJobRun(2, 'App\\Jobs\\Invoice', 'failed', true, 'database', 'default');
    seedJobRun(3, 'App\\Jobs\\Digest', 'running');
    seedJobRun(4, 'App\\Jobs\\Unconfirmed', 'queued', false);

    $response = $this->getJson('/skyline/api/jobs')->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('capabilities.jobs.view', true)
        ->assertJsonPath('capabilities.jobs.testJob', false)
        ->assertJsonPath('capabilities.shell.favorites', true)
        ->assertJsonCount(2, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Digest')
        ->assertJsonPath('jobs.1.name', 'App\\Jobs\\Invoice')
        ->assertJsonPath('jobs.1.runCount', 2)
        ->assertJsonPath('jobs.1.statusCounts.completed', 1)
        ->assertJsonPath('jobs.1.statusCounts.failed', 1)
        ->assertJsonPath('jobs.1.latestRun.id', 'job-run-01')
        ->assertJsonPath('hasAnyJobs', true);

    expect($response->json('jobs.1.id'))->toStartWith('job_')->not->toContain('Invoice')
        ->and($response->json('jobs.1.href'))->toBe('/skyline/jobs/'.$response->json('jobs.1.id'))
        ->and($response->json('jobs.1.latestRun.href'))->toBe('/skyline/runs/job-run-01')
        ->and($response->json('jobs.1.firstObservedAt'))->toEndWith('Z')
        ->and($response->json('jobs.1.lastObservedAt'))->toEndWith('Z')
        ->and(collect($response->json('options.timeRanges'))->pluck('value')->all())
        ->toBe(['1h', '24h', '7d', '30d', 'all']);
});

it('filters Job types by URL-backed search and server-supplied time range', function (): void {
    $now = Nanoseconds::now();
    seedJobRun(1, 'App\\Jobs\\RecentInvoice', 'completed', true, triggeredAt: $now - 3_600_000_000);
    seedJobRun(2, 'App\\Jobs\\OldInvoice', 'completed', true, triggeredAt: $now - 8 * 86_400_000_000_000);
    seedJobRun(3, 'App\\Jobs\\RecentDigest', 'completed', true, triggeredAt: $now - 3_600_000_000);

    $this->getJson('/skyline/api/jobs?'.http_build_query(['search' => 'invoice', 'period' => '7d']))
        ->assertOk()
        ->assertJsonCount(1, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\RecentInvoice')
        ->assertJsonPath('filters.search', 'invoice')
        ->assertJsonPath('filters.period', '7d');

    $this->getJson('/skyline/api/jobs?period=fortnight')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('treats Job search wildcards as literal text', function (): void {
    seedJobRun(1, 'App\\Jobs\\Invoice_100%', 'completed');
    seedJobRun(2, 'App\\Jobs\\InvoiceA100B', 'completed');

    $this->getJson('/skyline/api/jobs?'.http_build_query(['search' => '_100%']))
        ->assertOk()
        ->assertJsonCount(1, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Invoice_100%');
});

it('cursor-paginates Job types in stable name order and binds cursors to filters', function (): void {
    foreach (range(0, 26) as $index) {
        seedJobRun($index, sprintf('App\\Jobs\\Job%02d', $index), 'completed');
    }

    $first = $this->getJson('/skyline/api/jobs')->assertOk()
        ->assertJsonCount(25, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Job00')
        ->assertJsonPath('jobs.24.name', 'App\\Jobs\\Job24')
        ->assertJsonPath('pagination.previous', null);

    $next = $first->json('pagination.next');
    expect($next)->toBeString()->not->toContain('Job24');

    $second = $this->getJson('/skyline/api/jobs?'.http_build_query(['cursor' => $next]))->assertOk()
        ->assertJsonCount(2, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Job25')
        ->assertJsonPath('jobs.1.name', 'App\\Jobs\\Job26')
        ->assertJsonPath('pagination.next', null);

    $this->getJson('/skyline/api/jobs?'.http_build_query(['cursor' => $second->json('pagination.previous')]))
        ->assertOk()
        ->assertJsonCount(25, 'jobs')
        ->assertJsonPath('jobs.0.name', 'App\\Jobs\\Job00');

    $this->getJson('/skyline/api/jobs?'.http_build_query(['search' => 'Job2', 'cursor' => $next]))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');

    $this->getJson('/skyline/api/jobs?cursor=invalid')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('reports truthful per-hour Job activity for the source 24-hour column', function (): void {
    $now = Nanoseconds::now();
    seedJobRun(1, 'App\\Jobs\\Invoice', 'completed', triggeredAt: $now - (25 * 3_600_000_000_000));
    seedJobRun(2, 'App\\Jobs\\Invoice', 'running', triggeredAt: $now - (2 * 3_600_000_000_000));
    seedJobRun(3, 'App\\Jobs\\Invoice', 'failed', triggeredAt: $now - 3_600_000_000_000);

    $activity = $this->getJson('/skyline/api/jobs')->assertOk()->json('jobs.0.activity');

    expect($activity)->toHaveCount(2)
        ->and(array_sum(array_column($activity, 'total')))->toBe(2)
        ->and(array_sum(array_column(array_column($activity, 'statusCounts'), 'completed')))->toBe(0)
        ->and(array_sum(array_column(array_column($activity, 'statusCounts'), 'running')))->toBe(1)
        ->and(array_sum(array_column(array_column($activity, 'statusCounts'), 'failed')))->toBe(1)
        ->and(array_column($activity, 'timestamp'))->each->toMatch('/T\\d{2}:00:00Z$/');
});

it('projects high-cardinality Job summaries with a fixed query count in one snapshot', function (): void {
    foreach (range(0, 124) as $index) {
        seedJobRun($index, 'App\\Jobs\\HighVolume', $index % 2 === 0 ? 'completed' : 'failed');
    }

    $queries = [];
    DB::listen(function ($query) use (&$queries): void {
        if (str_contains(strtolower($query->sql), 'skyline_runs')) {
            $queries[] = ['sql' => strtolower($query->sql), 'transactionLevel' => $query->connection->transactionLevel()];
        }
    });

    $job = $this->getJson('/skyline/api/jobs')->assertOk()
        ->assertJsonPath('jobs.0.runCount', 125)
        ->assertJsonPath('jobs.0.statusCounts.completed', 63)
        ->assertJsonPath('jobs.0.statusCounts.failed', 62)
        ->assertJsonPath('jobs.0.latestRun.id', 'job-run-00')
        ->json('jobs.0');

    expect($queries)->toHaveCount(7)
        ->and(collect($queries)->pluck('transactionLevel')->every(fn (int $level): bool => $level > 0))->toBeTrue();

    $queries = [];

    $this->getJson('/skyline/api/jobs/'.$job['id'])->assertOk()
        ->assertJsonPath('job.runCount', 125)
        ->assertJsonCount(25, 'runs');

    expect($queries)->toHaveCount(15)
        ->and(collect($queries)->pluck('transactionLevel')->every(fn (int $level): bool => $level > 0))->toBeTrue();
});

it('shows Job activity Queue targets and cursor-paginated filtered Runs', function (): void {
    for ($index = 0; $index < 27; $index++) {
        seedJobRun(
            $index,
            'App\\Jobs\\Invoice',
            $index % 2 === 0 ? 'completed' : 'failed',
            true,
            $index % 2 === 0 ? 'redis' : 'database',
            $index % 2 === 0 ? 'billing' : 'default',
        );
    }
    seedJobRun(98, 'App\\Jobs\\Invoice', 'completed', true, 'sync', 'sync');
    seedJobRun(99, 'App\\Jobs\\Other', 'completed');
    $job = $this->getJson('/skyline/api/jobs')->assertOk()->json('jobs.0');

    $first = $this->getJson('/skyline/api/jobs/'.$job['id'].'?'.http_build_query(['status' => ['completed']]))
        ->assertOk()
        ->assertJsonPath('job.id', $job['id'])
        ->assertJsonPath('job.name', 'App\\Jobs\\Invoice')
        ->assertJsonCount(2, 'queueTargets')
        ->assertJsonPath('queueTargets.0.connection', 'database')
        ->assertJsonPath('queueTargets.1.connection', 'redis')
        ->assertJsonPath('filters.status.0', 'completed')
        ->assertJsonCount(15, 'runs');

    expect($first->json('activity'))->not->toBeEmpty()
        ->and($first->json('queueTargets.0.id'))->toStartWith('queue_')
        ->and($first->json('queueTargets.0.href'))->toStartWith('/skyline/queues/');

    $unfiltered = $this->getJson('/skyline/api/jobs/'.$job['id'])->assertOk()->assertJsonCount(25, 'runs');
    $next = $unfiltered->json('pagination.next');
    expect($next)->toBeString()->not->toContain('job-run');

    $this->getJson('/skyline/api/jobs/'.$job['id'].'?'.http_build_query(['cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(3, 'runs')
        ->assertJsonPath('pagination.next', null);
});

it('filters Job detail with Trigger duration and exact range values', function (): void {
    $now = Nanoseconds::now();
    seedJobRun(1, 'App\\Jobs\\Invoice', 'completed', triggeredAt: $now - 5 * 60_000_000_000);
    seedJobRun(2, 'App\\Jobs\\Invoice', 'failed', triggeredAt: $now - 2 * 3_600_000_000_000);
    $job = $this->getJson('/skyline/api/jobs')->assertOk()->json('jobs.0');

    $this->getJson('/skyline/api/jobs/'.$job['id'].'?period=90m')
        ->assertOk()
        ->assertJsonPath('filters.period', '90m')
        ->assertJsonPath('filters.from', null)
        ->assertJsonPath('filters.to', null)
        ->assertJsonCount(1, 'runs')
        ->assertJsonCount(1, 'activity')
        ->assertJsonStructure(['activityRange' => ['from', 'to']]);

    $from = intdiv($now - 3 * 3_600_000_000_000, 1_000_000);
    $to = intdiv($now - 90 * 60_000_000_000, 1_000_000);
    $this->getJson('/skyline/api/jobs/'.$job['id'].'?'.http_build_query(['from' => $from, 'to' => $to]))
        ->assertOk()
        ->assertJsonPath('filters.period', null)
        ->assertJsonPath('filters.from', (string) $from)
        ->assertJsonPath('filters.to', (string) $to)
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.status', 'failed')
        ->assertJsonCount(1, 'activity');

    $this->getJson('/skyline/api/jobs/'.$job['id'].'?period=999999d')->assertStatus(422);
    $this->getJson('/skyline/api/jobs/'.$job['id'].'?from=9999999999999999')->assertStatus(422);
});

it('returns the latest captured Laravel Job definition', function (): void {
    config()->set('app.editor', ['name' => 'vscode', 'base_path' => '/workspace/app']);
    seedJobRun(1, InspectableJob::class, 'completed', connection: 'redis', queue: 'billing');
    seedJobDefinition('job-run-01', [
        'laravel.job.file' => realpath(__DIR__.'/../Fixtures/Jobs/InspectableJob.php'),
        'laravel.job.file_line' => 12,
        'laravel.job.default_connection' => 'redis',
        'laravel.job.default_queue' => 'billing',
        'laravel.job.max_tries' => 5,
        'laravel.job.backoff' => '1,5,10',
        'laravel.job.retry_until' => 1_893_553_445,
    ]);
    $job = $this->getJson('/skyline/api/jobs')->assertOk()->json('jobs.0');

    $this->getJson('/skyline/api/jobs/'.$job['id'])
        ->assertOk()
        ->assertJsonPath('definition.file.path', realpath(__DIR__.'/../Fixtures/Jobs/InspectableJob.php'))
        ->assertJsonPath('definition.file.href', 'vscode://file/'.realpath(__DIR__.'/../Fixtures/Jobs/InspectableJob.php').':12')
        ->assertJsonPath('definition.defaultQueue.connection', 'redis')
        ->assertJsonPath('definition.defaultQueue.queue', 'billing')
        ->assertJsonPath('definition.retry.maxAttempts', 5)
        ->assertJsonPath('definition.retry.backoffSeconds', [1, 5, 10])
        ->assertJsonPath('definition.retry.retryUntil', '2030-01-02T03:04:05Z');
});

it('returns not found for unknown Job identity and safe read errors', function (): void {
    $this->getJson('/skyline/api/jobs/job_unknown')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found');

    $this->getJson('/skyline/api/jobs?search[]=&search[]=bad')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

function seedJobRun(
    int $index,
    string $job,
    string $status,
    bool $confirmed = true,
    string $connection = 'redis',
    string $queue = 'default',
    ?int $triggeredAt = null,
): void {
    $traceId = sprintf('%032x', $index + 10_000);
    $runId = sprintf('job-run-%02d', $index);
    $triggeredAt ??= Nanoseconds::now() - ($index * 1_000_000_000);
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
        'job_name' => $job,
        'connection' => $connection,
        'queue' => $queue,
        'status' => $status,
        'triggered_at' => $triggeredAt,
        'queued_at' => $triggeredAt + 1_000,
        'started_at' => $status === 'queued' ? null : $triggeredAt + 2_000,
        'finished_at' => in_array($status, ['completed', 'failed'], true) ? $triggeredAt + 3_000 : null,
        'confirmed_at' => $confirmed ? $confirmedAt : null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

/** @param array<string, int|string> $attributes */
function seedJobDefinition(string $runId, array $attributes): void
{
    DB::table('skyline_spans')->insert([
        'trace_id' => DB::table('skyline_runs')->where('run_id', $runId)->value('trace_id'),
        'run_id' => $runId,
        'attempt_number' => null,
        'span_id' => 'abcdef0123456789',
        'parent_span_id' => null,
        'name' => 'Job dispatch',
        'role' => 'producer',
        'kind' => 3,
        'status_code' => 'Ok',
        'status_description' => null,
        'started_at' => Nanoseconds::now(),
        'ended_at' => Nanoseconds::now(),
        'attributes' => json_encode($attributes, JSON_THROW_ON_ERROR),
        'events' => '[]',
        'links' => '[]',
        'resource_attributes' => '{}',
        'scope_name' => 'nickwelsh/skyline',
        'scope_version' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}
