<?php

use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;

return [
    'enabled' => env('SKYLINE_ENABLED', true),

    'path' => env('SKYLINE_PATH', 'skyline'),

    'middleware' => ['web'],

    'connection' => env('SKYLINE_DB_CONNECTION'),

    'storage_connection_name' => 'skyline',

    'sqlite_synchronous' => env('SKYLINE_SQLITE_SYNCHRONOUS', 'NORMAL'),

    'telemetry_sink' => PersistentTelemetrySink::class,

    'retention_hours' => env('SKYLINE_RETENTION_HOURS', 24),

    'failure_log_interval_seconds' => 60,

    'batch' => [
        'max_operations' => env('SKYLINE_BATCH_MAX_OPERATIONS', 5_000),
        'max_delay_ms' => env('SKYLINE_BATCH_MAX_DELAY_MS', 2_000),
    ],

    'sql' => [
        'capture_bindings' => env('SKYLINE_SQL_CAPTURE_BINDINGS', false),
        'capture_results' => env('SKYLINE_SQL_CAPTURE_RESULTS', false),
        'capture_source' => env('SKYLINE_SQL_CAPTURE_SOURCE', false),
        'max_binding_bytes' => env('SKYLINE_SQL_MAX_BINDING_BYTES', 16_384),
        'max_result_rows' => env('SKYLINE_SQL_MAX_RESULT_ROWS', 25),
        'max_result_bytes' => env('SKYLINE_SQL_MAX_RESULT_BYTES', 65_536),
        'redact_columns' => [
            'password',
            'passwd',
            'token',
            'secret',
            'authorization',
            'cookie',
            'api_key',
            'access_key',
            'private_key',
            'credit_card',
            'card_number',
            'cvv',
            'ssn',
        ],
    ],

    'http' => [
        'enabled' => env('SKYLINE_HTTP_ENABLED', true),
        'capture_query' => env('SKYLINE_HTTP_CAPTURE_QUERY', false),
        'capture_request_headers' => env('SKYLINE_HTTP_CAPTURE_REQUEST_HEADERS', false),
        'capture_request_body' => env('SKYLINE_HTTP_CAPTURE_REQUEST_BODY', false),
        'capture_response_headers' => env('SKYLINE_HTTP_CAPTURE_RESPONSE_HEADERS', false),
        'capture_response_body' => env('SKYLINE_HTTP_CAPTURE_RESPONSE_BODY', false),
        'capture_source' => env('SKYLINE_HTTP_CAPTURE_SOURCE', false),
        'max_url_bytes' => env('SKYLINE_HTTP_MAX_URL_BYTES', 8_192),
        'max_header_bytes' => env('SKYLINE_HTTP_MAX_HEADER_BYTES', 16_384),
        'max_body_bytes' => env('SKYLINE_HTTP_MAX_BODY_BYTES', 65_536),
        'header_allowlist' => [
            'accept',
            'cache-control',
            'content-length',
            'content-type',
            'date',
            'etag',
            'location',
            'server',
            'traceparent',
            'tracestate',
            'user-agent',
            'x-correlation-id',
            'x-request-id',
        ],
        'redact_headers' => [
            'authorization',
            'proxy-authorization',
            'cookie',
            'set-cookie',
            'x-api-key',
        ],
        'redact_body_fields' => [
            'password',
            'passwd',
            'token',
            'secret',
            'authorization',
            'cookie',
            'api_key',
            'access_key',
            'private_key',
            'credit_card',
            'card_number',
            'cvv',
            'ssn',
        ],
    ],

    'editor' => [
        'name' => env('SKYLINE_EDITOR'),
        'base_path' => env('SKYLINE_EDITOR_BASE_PATH'),
        'href' => env('SKYLINE_EDITOR_HREF'),
    ],

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
