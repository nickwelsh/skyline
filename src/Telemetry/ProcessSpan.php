<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Process\ProcessResult;
use Illuminate\Process\Exceptions\ProcessTimedOutException;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\StatusCode;
use Symfony\Component\Process\Exception\ProcessTimedOutException as SymfonyProcessTimedOutException;
use Symfony\Component\Process\Process;
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

    public function completeSymfony(Process $process): void
    {
        if ($this->ended) {
            return;
        }

        $this->span->setAttribute('process.exit_code', $process->getExitCode());
        $this->span->setAttribute('process.outcome', $process->isSuccessful() ? 'completed' : 'failed');
        $this->span->setStatus($process->isSuccessful() ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
        $this->end();
    }

    public function fail(Throwable $exception): void
    {
        if ($this->ended) {
            return;
        }

        $this->span->setAttribute('error.type', $exception::class);
        $timedOut = $exception instanceof ProcessTimedOutException || $exception instanceof SymfonyProcessTimedOutException;
        $this->span->setAttribute('process.timed_out', $timedOut);
        $this->span->setAttribute('process.outcome', $timedOut ? 'timed_out' : 'failed');
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
