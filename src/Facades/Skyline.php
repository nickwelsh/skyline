<?php

namespace NickWelsh\Skyline\Facades;

use Illuminate\Support\Facades\Facade;
use NickWelsh\Skyline\Telemetry\CustomTelemetry;

/**
 * @method static mixed measure(string $name, callable $callback, array<string, mixed> $attributes = [])
 * @method static void event(string $name, array<string, mixed> $attributes = [])
 *
 * @see CustomTelemetry
 */
final class Skyline extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return CustomTelemetry::class;
    }
}
