<?php

namespace NickWelsh\Skyline;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Process\Factory as ProcessFactory;
use Illuminate\Queue\Events\JobAttempted;
use Illuminate\Queue\Events\Looping;
use Illuminate\Support\ServiceProvider;
use NickWelsh\Skyline\Console\PruneCommand;
use NickWelsh\Skyline\Persistence\FailureReporter;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use NickWelsh\Skyline\Support\AssetManifest;
use NickWelsh\Skyline\Telemetry\AttemptRegistry;
use NickWelsh\Skyline\Telemetry\CacheInstrumentation;
use NickWelsh\Skyline\Telemetry\CustomTelemetry;
use NickWelsh\Skyline\Telemetry\DatabaseTransactionInstrumentation;
use NickWelsh\Skyline\Telemetry\DeliveryInstrumentation;
use NickWelsh\Skyline\Telemetry\InstrumentedFilesystemManager;
use NickWelsh\Skyline\Telemetry\InstrumentedProcessFactory;
use NickWelsh\Skyline\Telemetry\LogBreadcrumbInstrumentation;
use NickWelsh\Skyline\Telemetry\OutgoingHttpInstrumentation;
use NickWelsh\Skyline\Telemetry\ProcessInstrumentation;
use NickWelsh\Skyline\Telemetry\QueueInstrumentation;
use NickWelsh\Skyline\Telemetry\SkylineTracer;
use NickWelsh\Skyline\Telemetry\SourceLocator;
use NickWelsh\Skyline\Telemetry\SqlCapture;
use NickWelsh\Skyline\Telemetry\SqlResultRegistry;
use NickWelsh\Skyline\Telemetry\StorageInstrumentation;
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
        $this->app->singleton(AttemptRegistry::class);
        $this->app->singleton(CacheInstrumentation::class);
        $this->app->singleton(CustomTelemetry::class);
        $this->app->singleton(DatabaseTransactionInstrumentation::class);
        $this->app->singleton(DeliveryInstrumentation::class);
        $this->app->singleton(ProcessInstrumentation::class);
        $this->app->singleton(StorageInstrumentation::class);
        $this->app->singleton(LogBreadcrumbInstrumentation::class);
        $this->app->singleton(
            ProcessFactory::class,
            fn ($app) => new InstrumentedProcessFactory($app->make(ProcessInstrumentation::class)),
        );
        $this->app->singleton(
            'filesystem',
            fn ($app) => new InstrumentedFilesystemManager($app, $app->make(StorageInstrumentation::class)),
        );
        $this->app->alias('filesystem', FilesystemManager::class);
        $this->app->singleton(OutgoingHttpInstrumentation::class);
        $this->app->singleton(SkylineTracer::class);
        $this->app->singleton(SourceLocator::class);
        $this->app->singleton(SqlCapture::class);
        $this->app->singleton(SqlResultRegistry::class);
        $this->app->singleton(PersistentTelemetrySink::class);
        $this->app->singleton(PersistenceGuard::class);
        $this->app->singleton(SkylineConnection::class);
        $this->app->singleton(
            FailureReporter::class,
            fn ($app) => new FailureReporter(
                $app->make(LoggerInterface::class),
                max(0, (int) $app['config']->get('skyline.failure_log_interval_seconds', 60)),
            ),
        );
    }

    public function boot(GateContract $gate): void
    {
        if (! $gate->has('viewSkyline')) {
            $gate->define('viewSkyline', fn ($user = null): bool => $this->app->environment('local'));
        }

        $this->loadViewsFrom($this->packagePath('resources/views'), 'skyline');
        $this->loadRoutesFrom($this->packagePath('routes/web.php'));

        if ((bool) $this->app['config']->get('skyline.enabled', true)) {
            $this->bootInstrumentation();
            $this->bootBatchFlushing();
        }

        if ($this->app->runningInConsole()) {
            $this->commands([PruneCommand::class]);

            $this->publishes([
                $this->packagePath('config/skyline.php') => config_path('skyline.php'),
            ], 'skyline-config');

            $this->publishes([
                $this->packagePath('database/migrations') => database_path('migrations'),
            ], 'skyline-migrations');

            if ((bool) $this->app['config']->get('skyline.prune.schedule', true)) {
                $this->callAfterResolving(Schedule::class, function (Schedule $schedule): void {
                    $schedule->command('skyline:prune')->daily()->withoutOverlapping();
                });
            }
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

    private function bootBatchFlushing(): void
    {
        $sink = $this->app->make(TelemetrySink::class);

        if (! $sink instanceof PersistentTelemetrySink) {
            return;
        }

        $this->app->terminating(fn () => $sink->flush());
        $this->app['events']->listen(Looping::class, fn () => $sink->flushIfDue());
        $this->app['events']->listen(JobAttempted::class, fn () => $sink->flush());
    }
}
