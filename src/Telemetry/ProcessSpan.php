<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Process\ProcessResult;
use Illuminate\Process\Exceptions\ProcessTimedOutException;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\StatusCode;
use Throwable;

final class ProcessSpan
{
    private bool $ended = false;

    public function __construct(
        private readonly SpanInterface $span,
        public readonly string $runId,
        public readonly int $attempt,
        private readonly \Closure $onEnd,
    ) {}

    public function complete(ProcessResult $result): void
    {
        if ($this->ended) {
            return;
        }

        $this->span->setAttribute('process.exit_code', $result->exitCode());
        $this->span->setAttribute('process.outcome', $result->successful() ? 'completed' : 'failed');
        $this->span->setStatus($result->successful() ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
        $this->end();
    }

    public function fail(Throwable $exception): void
    {
        if ($this->ended) {
            return;
        }

        $this->span->setAttribute('error.type', $exception::class);
        $this->span->setAttribute('process.timed_out', $exception instanceof ProcessTimedOutException);
        $this->span->setAttribute('process.outcome', $exception instanceof ProcessTimedOutException ? 'timed_out' : 'failed');
        $this->span->setStatus(StatusCode::STATUS_ERROR);
        $this->end();
    }

    public function incomplete(): void
    {
        if ($this->ended) {
            return;
        }

        $this->span->setAttribute('process.outcome', 'incomplete');
        $this->span->setStatus(StatusCode::STATUS_ERROR);
        $this->end();
    }

    private function end(): void
    {
        $this->ended = true;
        $this->span->end();
        ($this->onEnd)($this);
    }
}
