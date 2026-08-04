<?php

namespace Tests;

use Illuminate\Queue\Queue;
use NickWelsh\Skyline\SkylineServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;
use Tests\Fixtures\RecordingTelemetrySink;

abstract class TestCase extends Orchestra
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
        ]);
        $app['config']->set('skyline.telemetry_sink', RecordingTelemetrySink::class);
    }

    protected function tearDown(): void
    {
        Queue::createPayloadUsing(null);

        parent::tearDown();
    }
}
