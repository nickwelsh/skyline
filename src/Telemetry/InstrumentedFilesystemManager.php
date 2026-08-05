<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Filesystem\FilesystemManager;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\FilesystemOperator;

final class InstrumentedFilesystemManager extends FilesystemManager
{
    private string $resolvingDisk = 'default';

    public function __construct($app, private readonly StorageInstrumentation $telemetry)
    {
        parent::__construct($app);
    }

    protected function resolve($name, $config = null)
    {
        $previous = $this->resolvingDisk;
        $this->resolvingDisk = (string) $name;

        try {
            return parent::resolve($name, $config);
        } finally {
            $this->resolvingDisk = $previous;
        }
    }

    protected function createFlysystem(FilesystemAdapter $adapter, array $config): FilesystemOperator
    {
        return new InstrumentedFilesystemOperator(
            parent::createFlysystem($adapter, $config),
            $this->telemetry,
            $this->resolvingDisk,
            is_string($config['driver'] ?? null) ? $config['driver'] : 'unknown',
        );
    }
}
