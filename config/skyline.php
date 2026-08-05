<?php

use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;

$captureAll = env('SKYLINE_CAPTURE_ALL', false);

return [
    'enabled' => env('SKYLINE_ENABLED', true),

    'capture_all' => $captureAll,

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
        'capture_bindings' => env('SKYLINE_SQL_CAPTURE_BINDINGS', $captureAll),
        'capture_results' => env('SKYLINE_SQL_CAPTURE_RESULTS', $captureAll),
        'capture_source' => env('SKYLINE_SQL_CAPTURE_SOURCE', $captureAll),
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
        'capture_query' => env('SKYLINE_HTTP_CAPTURE_QUERY', $captureAll),
        'capture_request_headers' => env('SKYLINE_HTTP_CAPTURE_REQUEST_HEADERS', $captureAll),
        'capture_request_body' => env('SKYLINE_HTTP_CAPTURE_REQUEST_BODY', $captureAll),
        'capture_response_headers' => env('SKYLINE_HTTP_CAPTURE_RESPONSE_HEADERS', $captureAll),
        'capture_response_body' => env('SKYLINE_HTTP_CAPTURE_RESPONSE_BODY', $captureAll),
        'capture_source' => env('SKYLINE_HTTP_CAPTURE_SOURCE', $captureAll),
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

    'cache' => [
        'enabled' => env('SKYLINE_CACHE_ENABLED', true),
        'capture_keys' => env('SKYLINE_CACHE_CAPTURE_KEYS', $captureAll),
        'capture_values' => env('SKYLINE_CACHE_CAPTURE_VALUES', $captureAll),
        'capture_source' => env('SKYLINE_CACHE_CAPTURE_SOURCE', $captureAll),
        'max_key_bytes' => env('SKYLINE_CACHE_MAX_KEY_BYTES', 256),
        'max_value_bytes' => env('SKYLINE_CACHE_MAX_VALUE_BYTES', 65_536),
    ],

    'custom' => [
        'enabled' => env('SKYLINE_CUSTOM_ENABLED', true),
        'max_attributes' => env('SKYLINE_CUSTOM_MAX_ATTRIBUTES', 32),
        'max_attribute_bytes' => env('SKYLINE_CUSTOM_MAX_ATTRIBUTE_BYTES', 1_024),
    ],

    'delivery' => [
        'enabled' => env('SKYLINE_DELIVERY_ENABLED', true),
        'capture_recipients' => env('SKYLINE_DELIVERY_CAPTURE_RECIPIENTS', $captureAll),
        'capture_content' => env('SKYLINE_DELIVERY_CAPTURE_CONTENT', $captureAll),
        'capture_source' => env('SKYLINE_DELIVERY_CAPTURE_SOURCE', $captureAll),
        'max_content_bytes' => env('SKYLINE_DELIVERY_MAX_CONTENT_BYTES', 65_536),
    ],

    'storage' => [
        'enabled' => env('SKYLINE_STORAGE_ENABLED', true),
        'capture_paths' => env('SKYLINE_STORAGE_CAPTURE_PATHS', $captureAll),
        'capture_source' => env('SKYLINE_STORAGE_CAPTURE_SOURCE', $captureAll),
        'max_path_bytes' => env('SKYLINE_STORAGE_MAX_PATH_BYTES', 512),
        'links' => [],
    ],

    'process' => [
        'enabled' => env('SKYLINE_PROCESS_ENABLED', true),
        'capture_source' => env('SKYLINE_PROCESS_CAPTURE_SOURCE', $captureAll),
    ],

    'logging' => [
        'enabled' => env('SKYLINE_LOGGING_ENABLED', $captureAll),
        'levels' => ['warning', 'error', 'critical', 'alert', 'emergency'],
        'channel' => env('SKYLINE_LOGGING_CHANNEL'),
        'context_allowlist' => ['code', 'status'],
        'max_breadcrumbs' => env('SKYLINE_LOGGING_MAX_BREADCRUMBS', 100),
        'max_message_bytes' => env('SKYLINE_LOGGING_MAX_MESSAGE_BYTES', 1_024),
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
