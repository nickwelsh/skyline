<?php

use Illuminate\Support\ServiceProvider;
use NickWelsh\Skyline\SkylineServiceProvider;

it('registers package defaults', function (): void {
    expect(config('skyline'))->toMatchArray([
        'path' => 'skyline',
        'middleware' => ['web'],
    ])->and(config('skyline.sql.capture_bindings'))->toBeFalse()
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
        ->and(config('skyline.cache.capture_source'))->toBeFalse()
        ->and(config('skyline.cache.max_key_bytes'))->toBe(256);
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
