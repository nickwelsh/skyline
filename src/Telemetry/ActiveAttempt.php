<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\Context\ContextInterface;
use Throwable;

final class ActiveAttempt
{
    public ?Throwable $exception = null;

    public bool $exceptionRecorded = false;

    public ?AttemptResult $result = null;

    public function __construct(
        public readonly string $runId,
        public readonly int $number,
        public readonly SpanInterface $span,
        public readonly ContextInterface $context,
    ) {}

    public function propose(AttemptResult $result): void
    {
        if ($this->result === null || $result->priority() > $this->result->priority()) {
            $this->result = $result;
        }
    }
}
