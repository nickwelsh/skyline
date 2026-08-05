<?php

namespace Tests\Fixtures\Jobs;

use GuzzleHttp\Promise\Promise;
use Illuminate\Cache\Events\RetrievingKey;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use NickWelsh\Skyline\Facades\Skyline;

final class LifecycleCleanupJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Event::dispatch(new RetrievingKey('array', 'unfinished-private-key'));
        Event::dispatch(new TransactionBeginning(DB::connection()));
        Skyline::measure('Unresolved async', fn (): Promise => new Promise);
    }
}
