<?php

use Illuminate\Support\ServiceProvider;
use NickWelsh\Skyline\SkylineServiceProvider;

it('registers package defaults', function (): void {
    expect(config('skyline'))->toMatchArray([
        'path' => 'skyline',
        'middleware' => ['web'],
    ])->and(config('skyline.capture_all'))->toBeFalse()
        ->and(config('skyline.sql.capture_bindings'))->toBeFalse()
        ->and(config('skyline.sql.capture_results'))->toBeFalse()
        ->and(config('skyline.sql.capture_source'))->toBeFalse()
        ->and(config('skyline.sql.max_result_rows'))->toBe(25)
        ->and(config('skyline.sql.max_result_bytes'))->toBe(65_536)
        ->and(config('skyline.http.enabled'))->toBeTrue()
        ->and(config('skyline.http.capture_query'))->toBeFalse()
        ->and(config('skyline.http.capture_request_headers'))->toBeFalse()
        ->and(config('skyline.http.capture_request_body'))->toBeFalse()
        ->and(config('skyline.http.capture_response_headers'))->toBeFalse()
        ->and(config('skyline.http.capture_response_body'))->toBeFalse()
        ->and(config('skyline.http.capture_source'))->toBeFalse()
        ->and(config('skyline.http.max_body_bytes'))->toBe(65_536)
        ->and(config('skyline.cache.enabled'))->toBeTrue()
        ->and(config('skyline.cache.capture_keys'))->toBeFalse()
        ->and(config('skyline.cache.capture_values'))->toBeFalse()
        ->and(config('skyline.cache.capture_source'))->toBeFalse()
        ->and(config('skyline.cache.max_key_bytes'))->toBe(256)
        ->and(config('skyline.cache.max_value_bytes'))->toBe(65_536)
        ->and(config('skyline.custom.enabled'))->toBeTrue()
        ->and(config('skyline.custom.max_attributes'))->toBe(32)
        ->and(config('skyline.custom.max_attribute_bytes'))->toBe(1_024)
        ->and(config('skyline.delivery.enabled'))->toBeTrue()
        ->and(config('skyline.delivery.capture_recipients'))->toBeFalse()
        ->and(config('skyline.delivery.capture_content'))->toBeFalse()
        ->and(config('skyline.delivery.capture_source'))->toBeFalse()
        ->and(config('skyline.delivery.max_content_bytes'))->toBe(65_536)
        ->and(config('skyline.storage.enabled'))->toBeTrue()
        ->and(config('skyline.storage.capture_paths'))->toBeFalse()
        ->and(config('skyline.storage.capture_source'))->toBeFalse()
        ->and(config('skyline.storage.links'))->toBe([])
        ->and(config('skyline.process.enabled'))->toBeTrue()
        ->and(config('skyline.process.capture_source'))->toBeFalse()
        ->and(config('skyline.logging.enabled'))->toBeFalse()
        ->and(config('skyline.logging.levels'))->toBe(['warning', 'error', 'critical', 'alert', 'emergency'])
        ->and(config('skyline.logging.context_allowlist'))->toBe(['code', 'status']);
});

it('uses one capture default while preserving individual overrides', function (): void {
    putenv('SKYLINE_CAPTURE_ALL=true');
    putenv('SKYLINE_HTTP_CAPTURE_REQUEST_BODY=false');

    try {
        $config = require dirname(__DIR__, 2).'/config/skyline.php';
        $inherited = [
            'sql.capture_bindings',
            'sql.capture_results',
            'sql.capture_source',
            'http.capture_query',
            'http.capture_request_headers',
            'http.capture_response_headers',
            'http.capture_response_body',
            'http.capture_source',
            'cache.capture_keys',
            'cache.capture_values',
            'cache.capture_source',
            'delivery.capture_recipients',
            'delivery.capture_content',
            'delivery.capture_source',
            'storage.capture_paths',
            'storage.capture_source',
            'process.capture_source',
            'logging.enabled',
        ];

        expect($config['capture_all'])->toBeTrue()
            ->and(collect($inherited)->every(fn (string $key): bool => data_get($config, $key) === true))->toBeTrue()
            ->and(data_get($config, 'http.capture_request_body'))->toBeFalse();
    } finally {
        putenv('SKYLINE_CAPTURE_ALL');
        putenv('SKYLINE_HTTP_CAPTURE_REQUEST_BODY');
    }
});

it('publishes config and the migration directory', function (): void {
    $config = ServiceProvider::pathsToPublish(SkylineServiceProvider::class, 'skyline-config');
    $migrations = ServiceProvider::pathsToPublish(SkylineServiceProvider::class, 'skyline-migrations');

    expect($config)->toBe([
        realpath(__DIR__.'/../../config/skyline.php') => config_path('skyline.php'),
    ])->and($migrations)->toBe([
        realpath(__DIR__.'/../../database/migrations') => database_path('migrations'),
    ]);
});

it('declares Laravel package discovery', function (): void {
    $composer = json_decode(file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);

    expect($composer['extra']['laravel']['providers'])->toContain(SkylineServiceProvider::class);
});
