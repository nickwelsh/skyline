<?php

use Illuminate\Support\Facades\Route;
use NickWelsh\Skyline\Http\Controllers\AssetController;
use NickWelsh\Skyline\Http\Controllers\DashboardController;
use NickWelsh\Skyline\Http\Middleware\Authorize;

$path = trim((string) config('skyline.path', 'skyline'), '/');
$middleware = [...config('skyline.middleware', ['web']), Authorize::class];

Route::prefix($path)
    ->middleware($middleware)
    ->group(function (): void {
        Route::get('assets/{asset}', AssetController::class)
            ->where('asset', '[A-Za-z0-9._-]+')
            ->name('skyline.asset');

        Route::get('{view?}', DashboardController::class)
            ->where('view', '.*')
            ->name('skyline.index');
    });
