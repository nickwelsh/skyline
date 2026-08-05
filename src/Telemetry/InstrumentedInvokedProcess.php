<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Process\InvokedProcess;
use Throwable;

final readonly class InstrumentedInvokedProcess implements InvokedProcess
{
    public function __construct(private InvokedProcess $inner, private ProcessSpan $span) {}

    public function id()
    {
        return $this->inner->id();
    }

    public function command()
    {
        return $this->inner->command();
    }

    public function signal(int $signal)
    {
        $this->inner->signal($signal);

        return $this;
    }

    public function running()
    {
        $running = $this->inner->running();

        if (! $running) {
            $this->completeIfFinished();
        }

        return $running;
    }

    public function output()
    {
        $output = $this->inner->output();
        $this->completeIfFinished();

        return $output;
    }

    public function errorOutput()
    {
        $output = $this->inner->errorOutput();
        $this->completeIfFinished();

        return $output;
    }

    public function latestOutput()
    {
        $output = $this->inner->latestOutput();
        $this->completeIfFinished();

        return $output;
    }

    public function latestErrorOutput()
    {
        $output = $this->inner->latestErrorOutput();
        $this->completeIfFinished();

        return $output;
    }

    public function stop(float $timeout = 10, ?int $signal = null)
    {
        $result = $this->inner->stop($timeout, $signal);
        $this->completeIfFinished();

        return $result;
    }

    public function ensureNotTimedOut(): void
    {
        try {
            $this->inner->ensureNotTimedOut();
        } catch (Throwable $exception) {
            $this->span->fail($exception);

            throw $exception;
        }
    }

    public function wait(?callable $output = null)
    {
        return $this->settle(fn () => $this->inner->wait($output));
    }

    public function waitUntil(?callable $output = null)
    {
        return $this->settle(fn () => $this->inner->waitUntil($output));
    }

    public function __call(string $method, array $arguments): mixed
    {
        return $this->inner->{$method}(...$arguments);
    }

    private function settle(callable $callback): mixed
    {
        try {
            $result = $callback();
            $this->span->complete($result);

            return $result;
        } catch (Throwable $exception) {
            $this->span->fail($exception);

            throw $exception;
        }
    }

    private function completeIfFinished(): void
    {
        try {
            if (! $this->inner->running()) {
                $this->span->complete($this->inner->wait());
            }
        } catch (Throwable $exception) {
            $this->span->fail($exception);
        }
    }
}
