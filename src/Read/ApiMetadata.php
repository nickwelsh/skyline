<?php

namespace NickWelsh\Skyline\Read;

use Composer\InstalledVersions;

final class ApiMetadata
{
    /** @return array{schemaVersion: 1, packageVersion: string, observedAt: string} */
    public function at(int $observedAt): array
    {
        return [
            'schemaVersion' => 1,
            'packageVersion' => InstalledVersions::getPrettyVersion('nickwelsh/skyline') ?? 'dev',
            'observedAt' => Nanoseconds::toRfc3339($observedAt),
        ];
    }
}
