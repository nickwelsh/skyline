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

    'trace_node_limit' => 25_000,

    'trace_poll_node_limit' => 1_000,

    'privacy' => [
        'exception_message_bytes' => 16_384,
        'sql_bytes' => 65_536,
        'metadata_string_bytes' => 65_536,
        'metadata_total_bytes' => 262_144,
    ],

    'prune' => [
        'schedule' => true,
        'chunk_size' => 500,
    ],
];
