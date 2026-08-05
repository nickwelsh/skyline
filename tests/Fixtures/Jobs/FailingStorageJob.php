<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToReadFile;
use RuntimeException;

final class FailingStorageJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        try {
            Storage::disk('telemetry')->get('private/missing.txt');
        } catch (UnableToReadFile) {
            return;
        }

        throw new RuntimeException('Storage failure behavior changed.');
    }
}
