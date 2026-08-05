<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use NickWelsh\Skyline\Facades\Skyline;
use RuntimeException;

final class FailingSummaryJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Log::warning('Failing Attempt token=private-token', ['code' => 500]);
        Skyline::measure('Before failure', fn (): int => 1);

        throw new RuntimeException('expected failure');
    }
}
