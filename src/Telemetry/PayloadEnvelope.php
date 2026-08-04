<?php

namespace NickWelsh\Skyline\Telemetry;

final readonly class PayloadEnvelope
{
    public const VERSION = 1;

    /** @param array<string, string> $carrier */
    public function __construct(
        public string $runId,
        public ?string $parentRunId,
        public int $queuedAt,
        public array $carrier,
    ) {}

    /** @param array<string, mixed> $payload */
    public static function fromPayload(array $payload): ?self
    {
        $envelope = $payload['skyline'] ?? null;

        if (! is_array($envelope)
            || ($envelope['v'] ?? null) !== self::VERSION
            || ! is_string($envelope['run_id'] ?? null)
            || ! is_int($envelope['queued_at_ns'] ?? null)
            || ! is_array($envelope['carrier'] ?? null)
        ) {
            return null;
        }

        $parentRunId = $envelope['parent_run_id'] ?? null;

        if ($parentRunId !== null && ! is_string($parentRunId)) {
            return null;
        }

        $carrier = array_filter(
            $envelope['carrier'],
            fn (mixed $value, mixed $key): bool => is_string($key) && is_string($value),
            ARRAY_FILTER_USE_BOTH,
        );

        return new self(
            $envelope['run_id'],
            $parentRunId,
            $envelope['queued_at_ns'],
            $carrier,
        );
    }

    /** @return array{v: 1, run_id: string, parent_run_id: ?string, queued_at_ns: int, carrier: array<string, string>} */
    public function toArray(): array
    {
        return [
            'v' => self::VERSION,
            'run_id' => $this->runId,
            'parent_run_id' => $this->parentRunId,
            'queued_at_ns' => $this->queuedAt,
            'carrier' => $this->carrier,
        ];
    }
}
