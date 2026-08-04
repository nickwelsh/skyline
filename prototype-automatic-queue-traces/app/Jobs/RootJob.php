<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class RootJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::table('prototype_records')->insert(['kind' => 'root', 'value' => 'root-ok']);
        ChildJob::dispatch();
    }
}
