<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class BenchmarkWorkJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $value = 'skyline';

        for ($iteration = 0; $iteration < 15_000; $iteration++) {
            $value = hash('sha256', $value, true);
        }

        for ($query = 0; $query < 3; $query++) {
            DB::select('select ? as value', [$query]);
        }
    }
}
