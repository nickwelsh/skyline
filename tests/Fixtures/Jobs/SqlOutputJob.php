<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

final class SqlOutputJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        DB::insert(
            'insert into sql_capture_values (name, password, api_token) values (?, ?, ?)',
            ['first-visible', 'password-secret', 'token-secret'],
        );
        DB::insert(
            'insert into sql_capture_values (name, password, api_token) values (?, ?, ?)',
            ['second-visible', 'second-password-secret', 'second-token-secret'],
        );
        DB::select('select name, password, api_token from sql_capture_values order by name');
    }
}
