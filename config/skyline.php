<?php

use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;

return [
    'path' => env('SKYLINE_PATH', 'skyline'),

    'middleware' => ['web'],

    'connection' => env('SKYLINE_DB_CONNECTION'),

    'storage_connection_name' => 'skyline',

    'telemetry_sink' => PersistentTelemetrySink::class,

    'retention_hours' => env('SKYLINE_RETENTION_HOURS', 24),

    'failure_log_interval_seconds' => 60,

    'prune' => [
        'schedule' => true,
        'chunk_size' => 500,
    ],
];
