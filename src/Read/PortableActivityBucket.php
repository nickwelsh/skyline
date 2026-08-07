<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use RuntimeException;

final class PortableActivityBucket
{
    public static function expression(Connection $connection, string $column, int $nanoseconds): string
    {
        $driver = (string) ($connection->getConfig('driver') ?: $connection->getDriverName());

        return match ($driver) {
            'mysql', 'mariadb' => "FLOOR({$column} / {$nanoseconds})",
            'pgsql' => "CAST({$column} / {$nanoseconds} AS BIGINT)",
            'sqlite' => "CAST({$column} / {$nanoseconds} AS INTEGER)",
            default => throw new RuntimeException("Skyline does not support activity bucketing on [{$driver}]."),
        };
    }
}
