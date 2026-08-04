<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class BenchmarkNoopJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void {}
}
