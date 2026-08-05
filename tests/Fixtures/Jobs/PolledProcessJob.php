<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;
use NickWelsh\Skyline\Facades\Skyline;
use RuntimeException;
use Symfony\Component\Process\Process as SymfonyProcess;

final class PolledProcessJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $process = Process::start([PHP_BINARY, '-r', 'fwrite(STDOUT, "polled output");']);

        while ($process->running()) {
            usleep(1_000);
        }

        if ($process->output() !== 'polled output') {
            throw new RuntimeException('Process telemetry changed polled output.');
        }

        $symfony = new SymfonyProcess([PHP_BINARY, '-r', 'fwrite(STDOUT, "symfony output");']);

        if (Skyline::process($symfony) !== 0 || $symfony->getOutput() !== 'symfony output') {
            throw new RuntimeException('Process telemetry changed Symfony Process behavior.');
        }
    }
}
