<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Process\Exceptions\ProcessTimedOutException;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class StorageProcessJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Storage::disk('telemetry')->put('private/customer/report.txt', 'private contents');
        $writeStream = fopen('php://temp', 'w+b');
        fwrite($writeStream, 'stream contents!');
        rewind($writeStream);
        Storage::disk('telemetry')->writeStream('private/customer/stream.txt', $writeStream);
        fclose($writeStream);

        if (Storage::disk('telemetry')->get('private/customer/report.txt') !== 'private contents') {
            throw new RuntimeException('Storage telemetry changed file contents.');
        }

        $stream = Storage::disk('telemetry')->readStream('private/customer/report.txt');

        if (! is_resource($stream) || stream_get_contents($stream) !== 'private contents') {
            throw new RuntimeException('Storage telemetry consumed the stream.');
        }

        fclose($stream);
        Storage::disk('telemetry')->copy('private/customer/report.txt', 'private/customer/report-copy.txt');
        Storage::disk('telemetry')->move('private/customer/report-copy.txt', 'private/customer/report-moved.txt');
        Storage::disk('telemetry')->size('private/customer/report-moved.txt');
        Storage::disk('telemetry')->delete(['private/customer/report.txt', 'private/customer/report-moved.txt', 'private/customer/stream.txt']);

        $success = Process::run([PHP_BINARY, '-r', 'fwrite(STDOUT, "private output");']);
        $failure = Process::run([PHP_BINARY, '-r', 'exit(7);']);
        $async = Process::start([PHP_BINARY, '-r', 'fwrite(STDOUT, "async output");'])->wait();

        try {
            Process::timeout(1)->run([PHP_BINARY, '-r', 'sleep(2);']);
        } catch (ProcessTimedOutException) {
            // The application intentionally handles the timeout.
        }

        if ($success->output() !== 'private output' || $failure->exitCode() !== 7 || $async->output() !== 'async output') {
            throw new RuntimeException('Process telemetry changed a process outcome.');
        }
    }
}
