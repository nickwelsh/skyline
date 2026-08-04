<?php

it('provides a composer-only Laravel fixture', function (): void {
    $fixture = realpath(__DIR__.'/../../fixtures/laravel');
    $composer = json_decode(file_get_contents($fixture.'/composer.json'), true, flags: JSON_THROW_ON_ERROR);

    expect($composer['require']['nickwelsh/skyline'])->toBe('@dev')
        ->and($composer['repositories'][0]['type'])->toBe('path')
        ->and($composer['autoload']['psr-4']['App\\'])->toBe('app/')
        ->and(file_exists($fixture.'/package.json'))->toBeFalse()
        ->and(file_exists($fixture.'/vite.config.js'))->toBeFalse()
        ->and(file_exists($fixture.'/prove.php'))->toBeTrue()
        ->and(file_exists($fixture.'/benchmark.php'))->toBeTrue()
        ->and(glob($fixture.'/app/Jobs/*Job.php'))->toHaveCount(8);
});
