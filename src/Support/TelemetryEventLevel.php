<?php

namespace NickWelsh\Skyline\Support;

final class TelemetryEventLevel
{
    public static function normalize(mixed $level): string
    {
        return match (strtolower(is_string($level) ? $level : 'info')) {
            'trace' => 'TRACE',
            'debug' => 'DEBUG',
            'warning', 'warn', 'notice' => 'WARN',
            'error', 'critical', 'alert', 'emergency' => 'ERROR',
            default => 'INFO',
        };
    }
}
