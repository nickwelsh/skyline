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
        return $this->inner->running();
    }

    public function output()
    {
        return $this->inner->output();
    }

    public function errorOutput()
    {
        return $this->inner->errorOutput();
    }

    public function latestOutput()
    {
        return $this->inner->latestOutput();
    }

    public function latestErrorOutput()
    {
        return $this->inner->latestErrorOutput();
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
}
