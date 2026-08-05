<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

final class StorageDetailJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $disk = Storage::disk('telemetry');
        $disk->put('reports/customer report.txt', 'private contents');
        $disk->exists('reports/customer report.txt');
        $disk->lastModified('reports/customer report.txt');
        $disk->mimeType('reports/customer report.txt');
        $disk->visibility('reports/customer report.txt');
        $disk->delete('reports/customer report.txt');
    }
}
