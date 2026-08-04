<?php

use NickWelsh\Skyline\Telemetry\NullTelemetrySink;

return [
    'path' => env('SKYLINE_PATH', 'skyline'),

    'middleware' => ['web'],

    'telemetry_sink' => NullTelemetrySink::class,
];
