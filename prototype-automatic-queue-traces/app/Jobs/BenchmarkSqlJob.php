<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class BenchmarkSqlJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        for ($query = 0; $query < 10; $query++) {
            DB::select('select ? as value', [$query]);
        }
    }
}
