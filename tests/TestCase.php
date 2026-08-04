<?php

namespace Tests;

use NickWelsh\Skyline\SkylineServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

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
    }
}
