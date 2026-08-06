<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

final class LongLogJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Log::warning(str_repeat('bounded ', 20));
    }
}
