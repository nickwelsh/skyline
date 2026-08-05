<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class FailingJob implements ShouldQueue
{
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 3;

    public int $backoff = 0;

    public function handle(): void
    {
        DB::table('proof_records')->insert([
            'kind' => 'failure',
            'value' => 'attempt-'.$this->attempts(),
        ]);

        throw new RuntimeException('terminal failure');
    }
}
