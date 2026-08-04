<?php

it('provides a composer-only Laravel fixture', function (): void {
    $fixture = realpath(__DIR__.'/../../fixtures/laravel');
    $composer = json_decode(file_get_contents($fixture.'/composer.json'), true, flags: JSON_THROW_ON_ERROR);

    expect($composer['require']['nickwelsh/skyline'])->toBe('@dev')
        ->and($composer['repositories'][0]['type'])->toBe('path')
        ->and(file_exists($fixture.'/package.json'))->toBeFalse()
        ->and(file_exists($fixture.'/vite.config.js'))->toBeFalse();
});
