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
        DB::select('select ? as private_value', ['child-secret']);
        DB::table('proof_records')->insert(['kind' => 'child', 'value' => 'ok']);
    }
}
