<?php

namespace NickWelsh\Skyline\Read;

use NickWelsh\Skyline\Telemetry\LogEventSanitizer;

final readonly class LogEventPresenter
{
    public function __construct(private LogEventSanitizer $sanitizer) {}

    /** @param array<string, mixed> $attributes @return array{level: string, message: string, context: array<string, bool|float|int|string>, channel: ?string, attributes: array<string, mixed>, capture: array{isTruncated: bool, truncated: list<array{path: string, originalBytes: int}>}} */
    public function present(array $attributes): array
    {
        return $this->sanitizer->present($attributes);
    }
}
