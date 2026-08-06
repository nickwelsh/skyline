<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
