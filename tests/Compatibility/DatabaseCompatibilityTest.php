<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Fixtures\Jobs\SqlJob;

it('migrates and persists a complete parameterized trace on the configured SQL engine', function (): void {
    SqlJob::dispatchSync('private-job-payload');

    expect(Schema::hasTable('skyline_traces'))->toBeTrue()
        ->and(Schema::hasTable('skyline_runs'))->toBeTrue()
        ->and(Schema::hasTable('skyline_attempts'))->toBeTrue()
        ->and(Schema::hasTable('skyline_spans'))->toBeTrue()
        ->and(DB::table('skyline_traces')->count())->toBe(1)
        ->and(DB::table('skyline_runs')->value('status'))->toBe('completed')
        ->and(DB::table('skyline_attempts')->value('status'))->toBe('completed')
        ->and(DB::table('skyline_spans')->count())->toBe(3)
        ->and(DB::table('skyline_spans')->where('role', 'sql')->value('attributes'))
        ->toContain('select ? as private_value')
        ->not->toContain('private-job-payload');
});
