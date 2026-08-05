<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;
use RuntimeException;

final class ProcessDetailJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $input = fopen('php://temp', 'w+b');
        fwrite($input, 'private input');
        rewind($input);

        $result = Process::env(['SKYLINE_PRIVATE_ENV' => 'private environment'])
            ->input($input)
            ->run([
                PHP_BINARY,
                '-r',
                'fwrite(STDOUT, getenv("SKYLINE_PRIVATE_ENV")." / ".stream_get_contents(STDIN)); fwrite(STDERR, "private error");',
            ]);
        fclose($input);

        if ($result->output() !== 'private environment / private input' || $result->errorOutput() !== 'private error') {
            throw new RuntimeException('Process telemetry changed sensitive process data.');
        }
    }
}
