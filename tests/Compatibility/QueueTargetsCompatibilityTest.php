<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;

it('aggregates Queue-target evidence portably on the configured SQL engine', function (): void {
    $now = Nanoseconds::now();
    foreach ([1_000_000, 3_000_000] as $index => $queueTime) {
        $runId = 'compatibility-queue-run-'.$index;
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
            'job_name' => 'App\\Jobs\\CompatibilityQueueJob',
            'connection' => 'redis',
            'queue' => 'compatibility',
            'status' => $index === 0 ? 'completed' : 'failed',
            'triggered_at' => $now - ($index * 1_000_000_000),
            'queued_at' => $now - ($index * 1_000_000_000),
            'started_at' => $now - ($index * 1_000_000_000) + $queueTime,
            'finished_at' => $now,
            'confirmed_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('skyline_attempts')->insert([
            'run_id' => $runId,
            'attempt_number' => 1,
            'status' => $index === 0 ? 'completed' : 'failed',
            'started_at' => $now - ($index * 1_000_000_000) + $queueTime,
            'finished_at' => $now,
            'queue_time_ns' => $queueTime,
            'queue_time_source' => 'framework_event',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $this->getJson('/skyline/api/queues')->assertOk()
        ->assertJsonPath('queueTargets.0.id', 'queue_'.hash('sha256', "redis\0compatibility"))
        ->assertJsonPath('queueTargets.0.recordedRunCounts.completed', 1)
        ->assertJsonPath('queueTargets.0.recordedRunCounts.failed', 1)
        ->assertJsonPath('queueTargets.0.queueTime.medianUs', 2000)
        ->assertJsonPath('queueTargets.0.queueTime.p95Us', 2900)
        ->assertJsonPath('queueTargets.0.queueTime.maximumUs', 3000);
});
