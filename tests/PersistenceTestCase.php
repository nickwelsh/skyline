<?php

namespace Tests;

use Illuminate\Queue\Queue;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\SkylineServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class PersistenceTestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [SkylineServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app->detectEnvironment(fn (): string => 'local');
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
        $app['config']->set('database.default', 'testing');
        $app['config']->set('database.connections.testing', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        $app['config']->set('skyline.telemetry_sink', PersistentTelemetrySink::class);
        $app['config']->set('skyline.prune.schedule', false);
        $app['config']->set('skyline.batch.max_operations', 1);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $migration = require dirname(__DIR__).'/database/migrations/2026_08_04_000000_create_skyline_telemetry_tables.php';
        $migration->up();
        $migration = require dirname(__DIR__).'/database/migrations/2026_08_05_000000_create_skyline_telemetry_events_table.php';
        $migration->up();
    }

    protected function tearDown(): void
    {
        Queue::createPayloadUsing(null);

        parent::tearDown();
    }
}
