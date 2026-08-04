<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class ParentJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::table('proof_records')->insert(['kind' => 'parent', 'value' => 'ok']);
        ChildJob::dispatch();
    }
}
