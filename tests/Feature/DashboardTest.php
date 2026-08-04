<?php

use Illuminate\Support\Facades\Gate;

it('serves the skyline shell and precompiled assets locally', function (): void {
    $entry = skylineAssetEntry();

    $this->get('/skyline')
        ->assertOk()
        ->assertSee('id="skyline"', false)
        ->assertSee('/skyline/assets/'.$entry['file'], false)
        ->assertSee('/skyline/assets/'.$entry['css'][0], false);

    $this->get('/skyline/assets/'.$entry['file'])
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=UTF-8')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertSee('Skyline', false);
});

it('serves the shell for client-side routes', function (): void {
    $this->get('/skyline/runs/example')->assertOk()->assertSee('id="skyline"', false);
});

it('denies non-local requests by default', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get('/skyline')->assertForbidden();
    $this->get('/skyline/assets/'.skylineAssetEntry()['file'])->assertForbidden();
});

it('uses the host viewSkyline gate outside local environments', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');
    Gate::define('viewSkyline', fn ($user = null): bool => true);

    $this->get('/skyline')->assertOk();
});

it('rejects assets absent from the manifest', function (): void {
    $this->get('/skyline/assets/not-real.js')->assertNotFound();
});

/** @return array{file: string, css: list<string>} */
function skylineAssetEntry(): array
{
    $manifest = json_decode(file_get_contents(__DIR__.'/../../dist/manifest.json'), true, flags: JSON_THROW_ON_ERROR);

    return $manifest['resources/js/app.tsx'];
}
