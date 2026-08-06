<?php

use Illuminate\Support\Facades\Gate;

it('serves the skyline shell and precompiled assets locally', function (): void {
    $entry = skylineAssetEntry();

    $response = $this->get('/skyline')
        ->assertOk()
        ->assertSee('id="skyline"', false)
        ->assertSee('id="skyline-bootstrap"', false)
        ->assertSee('/skyline/assets/'.$entry['file'], false)
        ->assertSee('/skyline/assets/'.$entry['css'][0], false);

    expect($response->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');

    $this->get('/skyline/assets/'.$entry['file'])
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=UTF-8')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertSee('Skyline', false);
});

it('prepaints stored appearance before styles load', function (): void {
    $html = $this->get('/skyline')->assertOk()->getContent();

    expect($html)->toContain('skyline.ui-preferences.v1:\/skyline')
        ->and(strpos($html, 'data-skyline-prepaint'))
        ->toBeLessThan(strpos($html, 'rel="stylesheet"'));
});

it('serves the shell for client-side routes', function (): void {
    $this->get('/skyline/runs/example')->assertOk()->assertSee('id="skyline"', false);
});

it('boots from one escaped inline payload with Application identity and capabilities', function (): void {
    config()->set('app.name', '</script><script>alert("no")</script>');
    $this->app->detectEnvironment(fn (): string => 'staging');
    Gate::define('viewSkyline', fn ($user = null): bool => true);

    $response = $this->get('/skyline')->assertOk();

    $response->assertSee('id="skyline-bootstrap"', false)
        ->assertSee('type="application/json"', false)
        ->assertDontSee('</script><script>alert', false);

    preg_match('/<script id="skyline-bootstrap" type="application\/json">(.*?)<\/script>/s', $response->getContent(), $match);
    $bootstrap = json_decode($match[1], true, flags: JSON_THROW_ON_ERROR);

    expect($bootstrap)->toMatchArray([
        'schemaVersion' => 1,
        'basePath' => '/skyline',
        'applicationName' => '</script><script>alert("no")</script>',
        'environmentLabel' => 'staging',
    ])->and($bootstrap['capabilities']['navigation']['runs'])->toBeTrue()
        ->and($bootstrap['capabilities']['runs']['cancel'])->toBeFalse();
});

it('denies non-local requests by default', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get('/skyline')->assertForbidden();
    $this->get('/skyline/assets/'.skylineAssetEntry()['file'])->assertForbidden();
    $this->getJson('/skyline/api/runs')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');
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
