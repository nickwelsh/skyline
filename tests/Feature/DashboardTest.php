<?php

use Illuminate\Support\Facades\Gate;

it('serves the skyline shell and precompiled assets locally', function (): void {
    $this->get('/skyline')
        ->assertOk()
        ->assertSee('id="skyline"', false)
        ->assertSee('/skyline/assets/skyline-foundation.7d581e1.js', false)
        ->assertSee('/skyline/assets/skyline-foundation.4ab391c.css', false);

    $this->get('/skyline/assets/skyline-foundation.7d581e1.js')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=UTF-8')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertSee('data-skyline-ready', false);
});

it('serves the shell for client-side routes', function (): void {
    $this->get('/skyline/runs/example')->assertOk()->assertSee('id="skyline"', false);
});

it('denies non-local requests by default', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get('/skyline')->assertForbidden();
    $this->get('/skyline/assets/skyline-foundation.7d581e1.js')->assertForbidden();
});

it('uses the host viewSkyline gate outside local environments', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');
    Gate::define('viewSkyline', fn ($user = null): bool => true);

    $this->get('/skyline')->assertOk();
});

it('rejects assets absent from the manifest', function (): void {
    $this->get('/skyline/assets/not-real.js')->assertNotFound();
});
