<?php

namespace NickWelsh\Skyline\Telemetry;

use GuzzleHttp\Promise\PromiseInterface;

final readonly class ContextualPromise implements PromiseInterface
{
    public function __construct(
        private PromiseInterface $inner,
        private \Closure $within,
    ) {}

    public function then(?callable $onFulfilled = null, ?callable $onRejected = null): PromiseInterface
    {
        return new self($this->inner->then(
            $this->wrap($onFulfilled),
            $this->wrap($onRejected),
        ), $this->within);
    }

    public function otherwise(callable $onRejected): PromiseInterface
    {
        return $this->then(null, $onRejected);
    }

    public function getState(): string
    {
        return $this->inner->getState();
    }

    public function resolve($value): void
    {
        $this->inner->resolve($value);
    }

    public function reject($reason): void
    {
        $this->inner->reject($reason);
    }

    public function cancel(): void
    {
        $this->inner->cancel();
    }

    public function wait(bool $unwrap = true): mixed
    {
        return $this->inner->wait($unwrap);
    }

    private function wrap(?callable $callback): ?callable
    {
        if ($callback === null) {
            return null;
        }

        return fn (mixed $value): mixed => ($this->within)($callback, $value);
    }
}
