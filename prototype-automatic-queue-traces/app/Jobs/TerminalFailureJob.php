<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class TerminalFailureJob implements ShouldQueue
{
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 2;

    public int $backoff = 0;

    public function handle(): void
    {
        DB::table('prototype_records')->insert([
            'kind' => 'failure',
            'value' => 'attempt-'.$this->attempts(),
        ]);

        throw new RuntimeException('terminal failure');
    }
}
