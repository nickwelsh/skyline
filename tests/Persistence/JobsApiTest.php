<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;

it('lists observed Job types with opaque identities and truthful summaries', function (): void {
    seedJobRun(1, 'App\\Jobs\\Invoice', 'completed', true, 'redis', 'billing');
    seedJobRun(2, 'App\\Jobs\\Invoice', 'failed', true, 'database', 'default');
    seedJobRun(3, 'App\\Jobs\\Digest', 'running');
    seedJobRun(4, 'App\\Jobs\\Unconfirmed', 'queued', false);

    $response = $this->getJson('/skyline/api/jobs')->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('capabilities.jobs.view', true)
        ->assertJsonPath('capabilities.jobs.testJob', false)
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
        ->assertJsonCount(14, 'runs');

    expect($first->json('activity'))->not->toBeEmpty()
        ->and($first->json('queueTargets.0.id'))->toStartWith('queue_')
        ->and($first->json('queueTargets.0.href'))->toStartWith('/skyline/queues/');

    $unfiltered = $this->getJson('/skyline/api/jobs/'.$job['id'])->assertOk()->assertJsonCount(25, 'runs');
    $next = $unfiltered->json('pagination.next');
    expect($next)->toBeString()->not->toContain('job-run');

    $this->getJson('/skyline/api/jobs/'.$job['id'].'?'.http_build_query(['cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(2, 'runs')
        ->assertJsonPath('pagination.next', null);
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
