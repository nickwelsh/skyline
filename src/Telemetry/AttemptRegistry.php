<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Queue\Job;
use WeakMap;

final class AttemptRegistry
{
    private const MAX_TRACKED_RUNS = 1024;

    /** @var array<string, ActiveAttempt> */
    private array $attempts = [];

    /** @var WeakMap<Job, ActiveAttempt> */
    private WeakMap $jobs;

    /** @var list<string> */
    private array $stack = [];

    /** @var array<string, array{timestamp: int, source: string}> */
    private array $readyAt = [];

    public function __construct()
    {
        $this->jobs = new WeakMap;
    }

    public function forJob(Job $job): ?ActiveAttempt
    {
        return $this->jobs[$job] ?? null;
    }

    public function push(ActiveAttempt $attempt, Job $job): void
    {
        $key = $this->key($attempt->runId, $attempt->number);
        $this->attempts[$key] = $attempt;
        $this->jobs[$job] = $attempt;
        $this->stack[] = $key;
    }

    public function get(string $runId, int $attempt): ?ActiveAttempt
    {
        return $this->attempts[$this->key($runId, $attempt)] ?? null;
    }

    public function current(): ?ActiveAttempt
    {
        $key = end($this->stack);

        return $key === false ? null : ($this->attempts[$key] ?? null);
    }

    /** @return list<ActiveAttempt> */
    public function all(): array
    {
        return array_values($this->attempts);
    }

    public function remove(ActiveAttempt $attempt): void
    {
        $key = $this->key($attempt->runId, $attempt->number);
        unset($this->attempts[$key]);

        foreach ($this->jobs as $job => $active) {
            if ($active === $attempt) {
                unset($this->jobs[$job]);
            }
        }

        $this->stack = array_values(array_filter(
            $this->stack,
            fn (string $value): bool => $value !== $key,
        ));
    }

    /** @return array{timestamp: int, source: string} */
    public function queueStart(string $connection, PayloadEnvelope $envelope, int $now): array
    {
        if ($connection === 'sync') {
            return ['timestamp' => $now, 'source' => 'sync'];
        }

        return $this->readyAt[$envelope->runId]
            ?? ['timestamp' => $envelope->queuedAt, 'source' => 'payload_estimate'];
    }

    public function rememberReadyAt(string $runId, int $timestamp, string $source): void
    {
        if (! isset($this->readyAt[$runId]) && count($this->readyAt) >= self::MAX_TRACKED_RUNS) {
            array_shift($this->readyAt);
        }

        $this->readyAt[$runId] = ['timestamp' => $timestamp, 'source' => $source];
    }

    public function forgetReadyAt(string $runId): void
    {
        unset($this->readyAt[$runId]);
    }

    private function key(string $runId, int $attempt): string
    {
        return $runId.':'.$attempt;
    }
}
