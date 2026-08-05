<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class RemoteStorageJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Storage::disk('remote-telemetry')->put('private/remote.txt', 'remote contents');

        if (Storage::disk('remote-telemetry')->get('private/remote.txt') !== 'remote contents') {
            throw new RuntimeException('Remote storage behavior changed.');
        }

        Storage::disk('remote-telemetry')->delete('private/remote.txt');
    }
}
