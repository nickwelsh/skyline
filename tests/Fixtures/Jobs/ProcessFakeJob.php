<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;

final class ProcessFakeJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Process::run(['fake-command', 'private-argument']);
        Process::start(['fake-async', 'private-argument'])->wait();
    }
}
