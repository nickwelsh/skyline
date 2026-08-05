<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Cache\Events\CacheHit;
use Illuminate\Cache\Events\RetrievingKey;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Redis\Events\CommandExecuted;
use Illuminate\Support\Facades\Event;

final class RedisJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $connection = new class
        {
            public function getName(): string
            {
                return 'default';
            }
        };

        Event::dispatch(new CommandExecuted('set', ['private-key', 'private-value'], 1.25, $connection));
        Event::dispatch(new RetrievingKey('redis', 'cache-private-key'));
        Event::dispatch(new CommandExecuted('get', ['cache-private-key'], 0.5, $connection));
        Event::dispatch(new CacheHit('redis', 'cache-private-key', 'private-value'));
    }
}
