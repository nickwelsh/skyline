<?php

namespace NickWelsh\Skyline;

use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Support\ServiceProvider;
use NickWelsh\Skyline\Support\AssetManifest;
use NickWelsh\Skyline\Telemetry\QueueInstrumentation;
use NickWelsh\Skyline\Telemetry\TelemetrySink;
use Psr\Log\LoggerInterface;
use Throwable;

final class SkylineServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom($this->packagePath('config/skyline.php'), 'skyline');

        $this->app->singleton(
            AssetManifest::class,
            fn () => new AssetManifest($this->packagePath('dist/manifest.json')),
        );

        if (! $this->app->bound(TelemetrySink::class)) {
            $this->app->singleton(
                TelemetrySink::class,
                fn ($app) => $app->make($app['config']->get('skyline.telemetry_sink')),
            );
        }

        $this->app->singleton(QueueInstrumentation::class);
    }

    public function boot(GateContract $gate): void
    {
        if (! $gate->has('viewSkyline')) {
            $gate->define('viewSkyline', fn ($user = null): bool => $this->app->environment('local'));
        }

        $this->loadViewsFrom($this->packagePath('resources/views'), 'skyline');
        $this->loadRoutesFrom($this->packagePath('routes/web.php'));
        $this->bootInstrumentation();

        if ($this->app->runningInConsole()) {
            $this->publishes([
                $this->packagePath('config/skyline.php') => config_path('skyline.php'),
            ], 'skyline-config');

            $this->publishes([
                $this->packagePath('database/migrations') => database_path('migrations'),
            ], 'skyline-migrations');
        }
    }

    private function packagePath(string $path): string
    {
        return dirname(__DIR__).DIRECTORY_SEPARATOR.$path;
    }

    private function bootInstrumentation(): void
    {
        try {
            $this->app->make(QueueInstrumentation::class)->boot();
        } catch (Throwable $exception) {
            try {
                $this->app->make(LoggerInterface::class)->warning(
                    'Skyline telemetry failed to boot.',
                    ['exception' => $exception],
                );
            } catch (Throwable) {
                // Monitoring failures cannot alter host behavior.
            }
        }
    }
}
