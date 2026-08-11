<?php

namespace Tests\Fixtures\Jobs;

use DateTimeImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class InspectableJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public function __construct()
    {
        $this->onConnection('redis')->onQueue('billing');
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [1, 5, 10];
    }

    public function retryUntil(): DateTimeImmutable
    {
        return new DateTimeImmutable('2030-01-02T03:04:05Z');
    }

    public function handle(): void {}
}
