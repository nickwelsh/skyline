<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use PDOException;

final class RetriedTransactionJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $attempt = 0;

        DB::transaction(function () use (&$attempt): void {
            $attempt++;

            if ($attempt === 1) {
                throw new PDOException('Deadlock found when trying to get lock');
            }

            DB::select('select 1 as retried_value');
        }, 2);
    }
}
