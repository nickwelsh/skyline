<?php

namespace NickWelsh\Skyline\Read;

use Closure;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class ConsistentRead
{
    public function __construct(private SkylineConnection $database) {}

    public function run(Closure $read): mixed
    {
        $connection = $this->database->get();
        if ($connection->transactionLevel() > 0) {
            return $read();
        }

        $driver = (string) ($connection->getConfig('driver') ?: $connection->getDriverName());
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $connection->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        }

        return $connection->transaction(function () use ($connection, $driver, $read): mixed {
            if ($driver === 'pgsql') {
                $connection->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            }

            return $read();
        }, 1);
    }
}
