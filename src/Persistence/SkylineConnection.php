<?php

namespace NickWelsh\Skyline\Persistence;

use Illuminate\Contracts\Config\Repository;
use Illuminate\Database\Connection;
use Illuminate\Database\DatabaseManager;
use RuntimeException;

final class SkylineConnection
{
    private ?Connection $connection = null;

    private bool $dedicated = false;

    public function __construct(
        private readonly DatabaseManager $database,
        private readonly Repository $config,
    ) {}

    public function get(): Connection
    {
        if ($this->connection !== null) {
            return $this->connection;
        }

        $source = (string) ($this->config->get('skyline.connection') ?: $this->config->get('database.default'));
        $configuration = $this->config->get("database.connections.{$source}");

        if (! is_array($configuration)) {
            throw new RuntimeException("Skyline database connection [{$source}] is not configured.");
        }

        $name = (string) $this->config->get('skyline.storage_connection_name', 'skyline');
        $inMemory = ($configuration['driver'] ?? null) === 'sqlite'
            && ($configuration['database'] ?? null) === ':memory:';

        if ($inMemory || $name === $source) {
            return $this->connection = $this->database->connection($source);
        }

        $this->config->set("database.connections.{$name}", $configuration);
        $this->database->purge($name);
        $this->dedicated = true;

        return $this->connection = $this->database->connection($name);
    }

    public function owns(string $connectionName): bool
    {
        return $this->dedicated
            && $connectionName === (string) $this->config->get('skyline.storage_connection_name', 'skyline');
    }
}
