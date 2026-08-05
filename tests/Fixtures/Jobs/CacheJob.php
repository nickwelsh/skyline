<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

final class CacheJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Cache::store('array')->put('customer:secret@example.test', 'private-value', 60);
        Cache::store('array')->get('customer:secret@example.test');
        Cache::store('array')->get('missing:secret@example.test');
        Cache::store('array')->forget('customer:secret@example.test');
    }
}
