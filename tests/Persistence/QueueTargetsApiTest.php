<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;

it('lists only confirmed named asynchronous Queue targets with recorded aggregates', function (): void {
    seedQueueTargetRun('a', 'completed', 'redis', 'billing', 1_000_000);
    seedQueueTargetRun('b', 'failed', 'redis', 'billing', 3_000_000);
    seedQueueTargetRun('c', 'running', 'database', 'default', null);
    seedQueueTargetRun('sync', 'completed', 'sync', 'sync', 2_000_000);
    seedQueueTargetRun('unnamed', 'completed', 'redis', '', 2_000_000);
    seedQueueTargetRun('unconfirmed', 'completed', 'redis', 'ignored', 2_000_000, false);

    $response = $this->getJson('/skyline/api/queues')->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('hasAnyQueueTargets', true)
        ->assertJsonPath('environmentSummary.queued', 0)
        ->assertJsonPath('environmentSummary.running', 1)
        ->assertJsonPath('environmentSummary.allocated', null)
        ->assertJsonPath('environmentSummary.limit', null)
        ->assertJsonPath('options.connections', ['database', 'redis'])
        ->assertJsonCount(2, 'queueTargets')
        ->assertJsonPath('queueTargets.0.connection', 'database')
        ->assertJsonPath('queueTargets.0.queue', 'default')
        ->assertJsonPath('queueTargets.0.recordedRunCounts.running', 1)
        ->assertJsonPath('queueTargets.0.queueTime.sampleCount', 0)
        ->assertJsonPath('queueTargets.1.id', 'queue_'.hash('sha256', "redis\0billing"))
        ->assertJsonPath('queueTargets.1.recordedRunCount', 2)
        ->assertJsonPath('queueTargets.1.recordedRunCounts.completed', 1)
        ->assertJsonPath('queueTargets.1.recordedRunCounts.failed', 1)
        ->assertJsonPath('queueTargets.1.queueTime.sampleCount', 2)
        ->assertJsonPath('queueTargets.1.queueTime.medianUs', 2000)
        ->assertJsonPath('queueTargets.1.queueTime.p95Us', 2900)
        ->assertJsonPath('queueTargets.1.queueTime.maximumUs', 3000);

    expect($response->json('queueTargets.1.firstObservedAt'))->toEndWith('Z')
        ->and($response->json('queueTargets.1.lastObservedAt'))->toEndWith('Z')
        ->and($response->json('capabilities.queues.workers'))->toBeFalse()
        ->and($response->json('capabilities.queues.concurrency'))->toBeFalse()
        ->and($response->getContent())->not->toContain('brokerDepth');
});

it('filters Queue targets with server supplied URL options and explicit invalid queries', function (): void {
    seedQueueTargetRun('billing', 'queued', 'redis', 'billing', 2_000_000);
    seedQueueTargetRun('mail', 'running', 'sqs', 'outbound-mail', 4_000_000);

    $page = $this->getJson('/skyline/api/queues?'.http_build_query([
        'connection' => 'redis',
        'search' => 'bill',
    ]))->assertOk()
        ->assertJsonCount(1, 'queueTargets')
        ->assertJsonPath('filters.connection', 'redis')
        ->assertJsonPath('filters.search', 'bill')
        ->assertJsonPath('environmentSummary.queued', 1)
        ->assertJsonPath('environmentSummary.running', 1)
        ->assertJsonPath('queueTargets.0.queue', 'billing');

    expect($page->json('options.connections'))->toBe(['redis', 'sqs'])
        ->and(collect($page->json('options.timeRanges'))->pluck('value')->all())
        ->toBe(['all', '1h', '24h', '7d']);

    $this->getJson('/skyline/api/queues?connection=missing')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
    $this->getJson('/skyline/api/queues?from=tomorrow')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('treats SQL wildcard characters as literal Queue-target Run search text', function (): void {
    seedQueueTargetRun('percent', 'completed', 'redis', 'billing', 2_000_000, job: 'App\\Jobs\\Bill%Invoice');
    seedQueueTargetRun('underscore', 'completed', 'redis', 'billing', 2_000_000, job: 'App\\Jobs\\Bill_Invoice');
    seedQueueTargetRun('plain', 'completed', 'redis', 'billing', 2_000_000, job: 'App\\Jobs\\BillXInvoice');
    $id = 'queue_'.hash('sha256', "redis\0billing");

    $this->getJson('/skyline/api/queues/'.$id.'?'.http_build_query(['search' => '%']))
        ->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.name', 'App\\Jobs\\Bill%Invoice');

    $this->getJson('/skyline/api/queues/'.$id.'?'.http_build_query(['search' => '_']))
        ->assertOk()
        ->assertJsonCount(1, 'runs')
        ->assertJsonPath('runs.0.name', 'App\\Jobs\\Bill_Invoice');
});

it('cursor-paginates Queue targets in stable destination order', function (): void {
    for ($index = 0; $index < 27; $index++) {
        seedQueueTargetRun('target-'.$index, 'completed', 'redis', sprintf('queue-%02d', $index), 1_000_000);
    }

    $first = $this->getJson('/skyline/api/queues')->assertOk()->assertJsonCount(25, 'queueTargets');
    $next = $first->json('pagination.next');
    expect($first->json('pagination.previous'))->toBeNull()
        ->and($next)->toBeString()->not->toContain('queue-24');

    $second = $this->getJson('/skyline/api/queues?'.http_build_query(['cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(2, 'queueTargets');
    $previous = $second->json('pagination.previous');

    expect($second->json('pagination.next'))->toBeNull()
        ->and($previous)->toBeString()
        ->and($this->getJson('/skyline/api/queues?'.http_build_query(['cursor' => $previous]))
            ->assertOk()->json('queueTargets'))->toBe($first->json('queueTargets'));
});

it('shows Queue-target activity, queue-time history, and cursor-paginated filtered Runs', function (): void {
    for ($index = 0; $index < 27; $index++) {
        seedQueueTargetRun(
            sprintf('%02d', $index),
            $index % 2 === 0 ? 'completed' : 'failed',
            'redis',
            'billing',
            ($index + 1) * 1_000_000,
        );
    }
    seedQueueTargetRun('other', 'completed', 'redis', 'other', 1_000_000);
    $id = 'queue_'.hash('sha256', "redis\0billing");

    $first = $this->getJson('/skyline/api/queues/'.$id.'?'.http_build_query([
        'status' => ['completed'],
        'search' => 'Job',
    ]))->assertOk()
        ->assertJsonPath('capabilities.navigation.queues', true)
        ->assertJsonPath('queueCapabilities.pause', false)
        ->assertJsonPath('queueCapabilities.resume', false)
        ->assertJsonPath('queueCapabilities.concurrency', false)
        ->assertJsonPath('queueCapabilities.allocation', false)
        ->assertJsonPath('queueCapabilities.rateLimit', false)
        ->assertJsonPath('queueCapabilities.workers', false)
        ->assertJsonPath('queueCapabilities.billing', false)
        ->assertJsonPath('queueCapabilities.environmentControls', false)
        ->assertJsonPath('queueTarget.id', $id)
        ->assertJsonPath('queueTarget.connection', 'redis')
        ->assertJsonPath('queueTarget.queue', 'billing')
        ->assertJsonPath('filters.status', ['completed'])
        ->assertJsonCount(14, 'runs')
        ->assertJsonCount(27, 'series.activity')
        ->assertJsonCount(27, 'series.queueTime')
        ->assertJsonPath('pagination.previous', null)
        ->assertJsonPath('pagination.next', null);

    expect(collect($first->json('runs'))->every(fn (array $run): bool => $run['status'] === 'completed'))->toBeTrue()
        ->and($first->json('runs.0.href'))->toStartWith('/skyline/runs/');

    $unfiltered = $this->getJson('/skyline/api/queues/'.$id)->assertOk()->assertJsonCount(25, 'runs');
    $next = $unfiltered->json('pagination.next');
    expect($next)->toBeString()->not->toContain('run-');

    $second = $this->getJson('/skyline/api/queues/'.$id.'?'.http_build_query(['cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(2, 'runs');
    $previous = $second->json('pagination.previous');

    expect($this->getJson('/skyline/api/queues/'.$id.'?'.http_build_query(['cursor' => $previous]))
        ->assertOk()->json('runs'))->toBe($unfiltered->json('runs'));
});

it('distinguishes not-found Queue targets from filtered-empty detail', function (): void {
    seedQueueTargetRun('one', 'completed', 'redis', 'billing', null);
    $id = 'queue_'.hash('sha256', "redis\0billing");

    $this->getJson('/skyline/api/queues/'.$id.'?search=missing')
        ->assertOk()
        ->assertJsonPath('hasAnyRuns', true)
        ->assertJsonCount(0, 'runs');

    $this->getJson('/skyline/api/queues/queue_missing')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found');
});

function seedQueueTargetRun(
    string $suffix,
    string $status,
    ?string $connection,
    ?string $queue,
    ?int $queueTimeNs,
    bool $confirmed = true,
    ?string $job = null,
): void {
    $ordinal = crc32($suffix);
    $traceId = sprintf('%032x', $ordinal);
    $runId = 'queue-run-'.$suffix;
    $triggeredAt = Nanoseconds::now() - ($ordinal * 1_000_000);
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
        'job_name' => $job ?? 'App\\Jobs\\Job'.$suffix,
        'connection' => $connection,
        'queue' => $queue,
        'status' => $status,
        'triggered_at' => $triggeredAt,
        'queued_at' => $queueTimeNs === null ? null : $triggeredAt,
        'started_at' => $status === 'queued' ? null : $triggeredAt + ($queueTimeNs ?? 1_000_000),
        'finished_at' => in_array($status, ['completed', 'failed'], true) ? $triggeredAt + 10_000_000 : null,
        'confirmed_at' => $confirmed ? $confirmedAt : null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    if ($queueTimeNs !== null) {
        DB::table('skyline_attempts')->insert([
            'run_id' => $runId,
            'attempt_number' => 1,
            'status' => $status === 'failed' ? 'failed' : ($status === 'running' ? 'running' : 'completed'),
            'started_at' => $triggeredAt + $queueTimeNs,
            'finished_at' => in_array($status, ['completed', 'failed'], true) ? $triggeredAt + 10_000_000 : null,
            'queue_time_ns' => $queueTimeNs,
            'queue_time_source' => 'framework_event',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
