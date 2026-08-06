<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use NickWelsh\Skyline\Facades\Skyline;

final class SummaryJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Log::info('ignored info');
        Log::warning('Import token=private-token delayed '.str_repeat('waiting ', 12), ['code' => 429, 'password' => 'private-password']);
        DB::select('select 1 as summary_value');
        Cache::store('array')->put('summary-private-key', 'private-value', 60);
        Skyline::measure('Summarize import', fn (): int => 1);
        Log::error('Import failed password=private-password', ['status' => 'handled']);
    }
}
