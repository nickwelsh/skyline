<?php

namespace Tests;

use Illuminate\Queue\Queue;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\SkylineServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class CompatibilityTestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [SkylineServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $driver = getenv('SKYLINE_TEST_DB_DRIVER') ?: 'sqlite';
        $connection = $driver === 'sqlite'
            ? ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]
            : [
                'driver' => $driver,
                'host' => getenv('SKYLINE_TEST_DB_HOST') ?: '127.0.0.1',
                'port' => getenv('SKYLINE_TEST_DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306'),
                'database' => getenv('SKYLINE_TEST_DB_DATABASE') ?: 'skyline',
                'username' => getenv('SKYLINE_TEST_DB_USERNAME') ?: ($driver === 'pgsql' ? 'postgres' : 'root'),
                'password' => getenv('SKYLINE_TEST_DB_PASSWORD') ?: 'skyline',
                'charset' => $driver === 'pgsql' ? 'utf8' : 'utf8mb4',
                'collation' => $driver === 'pgsql' ? null : 'utf8mb4_unicode_ci',
                'prefix' => '',
                'prefix_indexes' => true,
            ];

        $app->detectEnvironment(fn (): string => 'local');
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
        $app['config']->set('database.default', 'compatibility');
        $app['config']->set('database.connections.compatibility', array_filter(
            $connection,
            static fn (mixed $value): bool => $value !== null,
        ));
        $app['config']->set('skyline.connection', 'compatibility');
        $app['config']->set('skyline.storage_connection_name', 'skyline_compatibility');
        $app['config']->set('skyline.telemetry_sink', PersistentTelemetrySink::class);
        $app['config']->set('skyline.prune.schedule', false);
        $app['config']->set('skyline.batch.max_operations', 1);
        $app['config']->set('skyline.sql.capture_bindings', true);
        $app['config']->set('skyline.sql.capture_results', true);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $migration = require dirname(__DIR__).'/database/migrations/2026_08_04_000000_create_skyline_telemetry_tables.php';
        $migration->up();
    }

    protected function tearDown(): void
    {
        $migration = require dirname(__DIR__).'/database/migrations/2026_08_04_000000_create_skyline_telemetry_tables.php';
        $migration->down();
        Queue::createPayloadUsing(null);

        parent::tearDown();
    }
}
