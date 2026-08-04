<?php

namespace App\Providers;

use App\Telemetry\SkylinePrototype;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SkylinePrototype::class, fn () => new SkylinePrototype(
            storage_path('app/skyline-prototype-spans.sqlite'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(SkylinePrototype $skyline): void
    {
        $skyline->boot();
    }
}
