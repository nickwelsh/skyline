<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use LogicException;

final class TransactionJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::connection('testing')->transaction(function (): void {
            DB::connection('testing')->select('select 1 as outer_value');
            DB::connection('testing')->transaction(
                fn () => DB::connection('testing')->select('select 2 as nested_value'),
            );
        });

        try {
            DB::connection('testing')->transaction(function (): void {
                DB::connection('testing')->select('select 3 as rollback_value');
                throw new LogicException('rollback reason must not leak');
            });
        } catch (LogicException) {
            // The Job intentionally continues after the rollback.
        }

        DB::connection('secondary')->transaction(
            fn () => DB::connection('secondary')->select('select 4 as secondary_value'),
        );
    }
}
