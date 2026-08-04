<?php

it('serves the fingerprinted Trigger interface without consumer build tooling', function (): void {
    $manifest = json_decode(file_get_contents(__DIR__.'/../../dist/manifest.json'), true, flags: JSON_THROW_ON_ERROR);
    $entry = $manifest['resources/js/app.tsx'];

    expect($entry['file'])->toMatch('/^skyline\.[a-f0-9]{8}\.js$/')
        ->and($entry['css'])->toHaveCount(1)
        ->and($entry['css'][0])->toMatch('/^skyline\.[a-f0-9]{8}\.css$/');

    $this->get('/skyline')
        ->assertOk()
        ->assertSee('/skyline/assets/'.$entry['file'], false)
        ->assertSee('/skyline/assets/'.$entry['css'][0], false);

    $this->get('/skyline/assets/'.$entry['file'])
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=UTF-8')
        ->assertSee('Skyline');

    $this->get('/skyline/assets/'.$entry['css'][0])
        ->assertOk()
        ->assertHeader('Content-Type', 'text/css; charset=UTF-8');

    $font = collect($entry['assets'])->first(
        fn (string $asset): bool => str_ends_with($asset, '.woff2'),
    );

    expect($font)->not->toBeNull();

    $this->get('/skyline/assets/'.$font)
        ->assertOk()
        ->assertHeader('Content-Type', 'font/woff2')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');

    expect(file_exists(__DIR__.'/../../THIRD_PARTY_NOTICES.md'))->toBeTrue()
        ->and(file_exists(__DIR__.'/../../licenses/trigger.dev-APACHE-2.0.txt'))->toBeTrue()
        ->and(file_exists(__DIR__.'/../../resources/js/trigger/import-manifest.json'))->toBeTrue()
        ->and(file_exists(__DIR__.'/../../package.json'))->toBeTrue()
        ->and(file_exists(__DIR__.'/../../pnpm-lock.yaml'))->toBeTrue();
});
