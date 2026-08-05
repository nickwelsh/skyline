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
}
