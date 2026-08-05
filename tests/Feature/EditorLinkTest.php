<?php

use NickWelsh\Skyline\Read\EditorLink;

it('builds Laravel-compatible editor links with a mapped base path', function (): void {
    config()->set('app.editor', null);
    config()->set('skyline.editor', ['name' => 'vscode', 'base_path' => '/workspace/app']);

    expect(app(EditorLink::class)->href(base_path('app/Jobs/ImportJob.php'), 42))
        ->toBe('vscode://file//workspace/app/app/Jobs/ImportJob.php:42');
});

it('supports a custom editor href', function (): void {
    config()->set('app.editor', ['href' => 'editor://open/{file}/{line}']);

    expect(app(EditorLink::class)->href('/srv/app/Jobs/ImportJob.php', 7))
        ->toBe('editor://open//srv/app/Jobs/ImportJob.php/7');
});
