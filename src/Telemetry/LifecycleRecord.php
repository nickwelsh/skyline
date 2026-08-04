<?php

namespace NickWelsh\Skyline\Telemetry;

final readonly class LifecycleRecord
{
    /** @param array<string, bool|int|float|string|null> $attributes */
    public function __construct(
        public Lifecycle $type,
        public string $runId,
        public ?int $attempt,
        public int $observedAt,
        public array $attributes = [],
    ) {}
}
