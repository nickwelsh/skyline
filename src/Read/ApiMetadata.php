<?php

namespace NickWelsh\Skyline\Read;

use Composer\InstalledVersions;

final class ApiMetadata
{
    public function __construct(private Capabilities $capabilities) {}

    /** @return array{schemaVersion: 1, packageVersion: string, generatedAt: string, capabilities: array<string, array<string, bool>>} */
    public function at(int $generatedAt): array
    {
        return [
            'schemaVersion' => 1,
            'packageVersion' => InstalledVersions::getPrettyVersion('nickwelsh/skyline') ?? 'dev',
            'generatedAt' => Nanoseconds::toRfc3339($generatedAt),
            'capabilities' => $this->capabilities->all(),
        ];
    }
}
