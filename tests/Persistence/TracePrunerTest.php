<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Persistence\TracePruner;
use NickWelsh\Skyline\Persistence\TraceRepository;

it('prunes expired terminal Traces whole while retaining active and current Traces', function (): void {
    $now = 2_000_000_000_000_000_000;
    $expired = $now - 25 * 3_600_000_000_000;
    $current = $now - 23 * 3_600_000_000_000;
    /** @var TraceRepository $traces */
    $traces = app(TraceRepository::class);

    $traces->ensureRun('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'expired-run', null, $expired, 'Expired Job');
    $traces->ensureRun('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'active-run', null, $expired, 'Active Job');
    $traces->ensureRun('cccccccccccccccccccccccccccccccc', 'current-run', null, $current, 'Current Job');
    DB::table('skyline_runs')->where('run_id', 'expired-run')->update(['status' => 'completed']);
    DB::table('skyline_runs')->where('run_id', 'active-run')->update(['status' => 'retrying', 'confirmed_at' => $expired]);
    DB::table('skyline_runs')->where('run_id', 'current-run')->update(['status' => 'completed']);
    DB::table('skyline_attempts')->insert([
        'run_id' => 'expired-run',
        'attempt_number' => 1,
        'status' => 'completed',
        'started_at' => $expired,
        'finished_at' => $expired + 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    /** @var TracePruner $pruner */
    $pruner = app(TracePruner::class);

    expect($pruner->prune(24, 1, $now))->toBe(1)
        ->and(DB::table('skyline_traces')->pluck('trace_id')->sort()->values()->all())->toBe([
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'cccccccccccccccccccccccccccccccc',
        ])
        ->and(DB::table('skyline_runs')->where('run_id', 'expired-run')->doesntExist())->toBeTrue()
        ->and(DB::table('skyline_attempts')->where('run_id', 'expired-run')->doesntExist())->toBeTrue()
        ->and($pruner->prune(24, 1, $now))->toBe(0);
});

it('registers the manual prune command', function (): void {
    $this->artisan('skyline:prune')->assertSuccessful();
});
