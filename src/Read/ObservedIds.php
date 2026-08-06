<?php

namespace NickWelsh\Skyline\Read;

final class ObservedIds
{
    public static function job(string $name): string
    {
        return 'job_'.hash('sha256', $name);
    }

    public static function queue(string $connection, string $queue): string
    {
        return 'queue_'.hash('sha256', $connection."\0".$queue);
    }

    public static function telemetryEvent(string $traceId, string $spanId, string $variant, int $index = 0): string
    {
        return 'event_'.hash('sha256', implode("\0", [$traceId, $spanId, $variant, (string) $index]));
    }
}
