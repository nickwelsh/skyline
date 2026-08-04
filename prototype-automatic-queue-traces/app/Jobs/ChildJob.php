<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class ChildJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::table('prototype_records')->where('kind', 'root')->count();
        DB::table('prototype_records')->insert(['kind' => 'child', 'value' => 'child-ok']);
    }
}
