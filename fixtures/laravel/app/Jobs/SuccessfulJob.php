<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class SuccessfulJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::select('select ? as private_value', ['successful-secret']);
        DB::table('proof_records')->insert(['kind' => 'successful', 'value' => 'ok']);
    }
}
