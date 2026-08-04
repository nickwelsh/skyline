<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class RetryJob implements ShouldQueue
{
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 2;

    public int $backoff = 0;

    public function handle(): void
    {
        DB::table('prototype_records')->insert([
            'kind' => 'retry',
            'value' => 'attempt-'.$this->attempts(),
        ]);

        if ($this->attempts() === 1) {
            throw new RuntimeException('retry once');
        }
    }
}
