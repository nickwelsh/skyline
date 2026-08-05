<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\Context\ContextInterface;
use Throwable;

final class ActiveAttempt
{
    private int $startedMemory;

    private int $startedCpu;

    /** @var array<string, array{count: int, duration_ns: int}> */
    private array $aggregates = [];

    private int $breadcrumbCount = 0;

    public ?Throwable $exception = null;

    public bool $exceptionRecorded = false;

    public ?AttemptResult $result = null;

    public function __construct(
        public readonly string $runId,
        public readonly int $number,
        public readonly SpanInterface $span,
        public readonly ContextInterface $context,
    ) {
        $this->startedMemory = memory_get_usage(true);
        $this->startedCpu = $this->cpuTime();
    }

    public function propose(AttemptResult $result): void
    {
        if ($this->result === null || $result->priority() > $this->result->priority()) {
            $this->result = $result;
        }
    }

    public function recordSpan(string $role, int $duration): void
    {
        if (in_array($role, ['producer', 'consumer'], true)) {
            return;
        }

        $this->aggregates[$role] ??= ['count' => 0, 'duration_ns' => 0];
        $this->aggregates[$role]['count']++;
        $this->aggregates[$role]['duration_ns'] += max(0, $duration);
    }

    public function reserveBreadcrumb(int $limit): bool
    {
        if ($this->breadcrumbCount >= max(0, $limit)) {
            return false;
        }

        $this->breadcrumbCount++;

        return true;
    }

    /** @return array<string, bool|float|int|string> */
    public function summaryAttributes(): array
    {
        $attributes = [
            'skyline.summary.memory_peak_bytes' => memory_get_peak_usage(true),
            'skyline.summary.memory_peak_source' => 'php_process_lifetime',
            'skyline.summary.memory_delta_bytes' => memory_get_usage(true) - $this->startedMemory,
            'skyline.summary.cpu_time_us' => max(0, $this->cpuTime() - $this->startedCpu),
        ];

        foreach ($this->aggregates as $role => $aggregate) {
            $role = preg_replace('/[^a-z0-9_]+/i', '_', $role) ?: 'other';
            $attributes['skyline.summary.'.$role.'.count'] = $aggregate['count'];
            $attributes['skyline.summary.'.$role.'.duration_ms'] = $aggregate['duration_ns'] / 1_000_000;
        }

        return $attributes;
    }

    private function cpuTime(): int
    {
        $usage = getrusage();

        return ((int) ($usage['ru_utime.tv_sec'] ?? 0) + (int) ($usage['ru_stime.tv_sec'] ?? 0)) * 1_000_000
            + (int) ($usage['ru_utime.tv_usec'] ?? 0)
            + (int) ($usage['ru_stime.tv_usec'] ?? 0);
    }
}
