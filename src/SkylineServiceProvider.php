<?php

namespace NickWelsh\Skyline;

use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Support\ServiceProvider;
use NickWelsh\Skyline\Support\AssetManifest;

final class SkylineServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom($this->packagePath('config/skyline.php'), 'skyline');

        $this->app->singleton(
            AssetManifest::class,
            fn () => new AssetManifest($this->packagePath('dist/manifest.json')),
        );
    }

    public function boot(GateContract $gate): void
    {
        if (! $gate->has('viewSkyline')) {
            $gate->define('viewSkyline', fn ($user = null): bool => $this->app->environment('local'));
        }

        $this->loadViewsFrom($this->packagePath('resources/views'), 'skyline');
        $this->loadRoutesFrom($this->packagePath('routes/web.php'));

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
}
