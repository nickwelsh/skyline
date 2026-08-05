<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

final class ThreeAttemptJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(private readonly ?int $succeedOnAttempt = null) {}

    public function handle(): void
    {
        if ($this->succeedOnAttempt === null || $this->attempts() < $this->succeedOnAttempt) {
            throw new RuntimeException('Expected retry failure.');
        }
    }
}
