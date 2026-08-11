<?php

use Illuminate\Support\Facades\Route;
use NickWelsh\Skyline\Http\Controllers\AssetController;
use NickWelsh\Skyline\Http\Controllers\DashboardController;
use NickWelsh\Skyline\Http\Controllers\ErrorGroupsController;
use NickWelsh\Skyline\Http\Controllers\JobsController;
use NickWelsh\Skyline\Http\Controllers\NodeController;
use NickWelsh\Skyline\Http\Controllers\QueueTargetsController;
use NickWelsh\Skyline\Http\Controllers\RunsController;
use NickWelsh\Skyline\Http\Controllers\TelemetryEventsController;
use NickWelsh\Skyline\Http\Controllers\TraceController;
use NickWelsh\Skyline\Http\Middleware\Authorize;

$path = trim((string) config('skyline.path', 'skyline'), '/');
$middleware = [...config('skyline.middleware', ['web']), Authorize::class];

Route::prefix($path)
    ->middleware($middleware)
    ->group(function (): void {
        Route::get('assets/{asset}', AssetController::class)
            ->where('asset', '.*')
            ->name('skyline.asset');

        Route::get('api/runs', [RunsController::class, 'index'])->name('skyline.api.runs.index');
        Route::get('api/runs/updates', [RunsController::class, 'updates'])->name('skyline.api.runs.updates');
        Route::get('api/runs/{run}', TraceController::class)->name('skyline.api.runs.show');
        Route::get('api/runs/{run}/nodes/{node}', NodeController::class)->name('skyline.api.nodes.show');
        Route::get('api/jobs', [JobsController::class, 'index'])->name('skyline.api.jobs.index');
        Route::get('api/jobs/{job}', [JobsController::class, 'show'])->name('skyline.api.jobs.show');
        Route::get('api/errors', [ErrorGroupsController::class, 'index'])->name('skyline.api.errors.index');
        Route::get('api/errors/{error}', [ErrorGroupsController::class, 'show'])->name('skyline.api.errors.show');
        Route::get('api/logs', [TelemetryEventsController::class, 'index'])->name('skyline.api.logs.index');
        Route::get('api/logs/{event}', [TelemetryEventsController::class, 'show'])->name('skyline.api.logs.show');
        Route::get('api/queues', [QueueTargetsController::class, 'index'])->name('skyline.api.queues.index');
        Route::get('api/queues/{queue}', [QueueTargetsController::class, 'show'])->name('skyline.api.queues.show');

        Route::get('{view?}', DashboardController::class)
            ->where('view', '.*')
            ->name('skyline.index');
    });
