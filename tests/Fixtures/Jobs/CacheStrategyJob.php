<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

final class CacheStrategyJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Cache::store('array')->remember('remembered-key', 60, fn (): string => 'private-value');
        Cache::store('array')->flexible('flexible-key', [30, 120], fn (): string => 'private-value');
        Cache::store('array')->many(['batch-one' => 'private-default', 'batch-two' => 'private-default']);
    }
}
