<?php

namespace NickWelsh\Skyline\Persistence;

use NickWelsh\Skyline\Telemetry\Lifecycle;
use NickWelsh\Skyline\Telemetry\LifecycleRecord;
use NickWelsh\Skyline\Telemetry\TelemetrySink;
use OpenTelemetry\SDK\Trace\SpanDataInterface;
use Throwable;

final class PersistentTelemetrySink implements TelemetrySink
{
    /** @var array<string, list<SpanDataInterface>> */
    private array $spanBuffers = [];

    public function __construct(
        private readonly SkylineConnection $database,
        private readonly PersistenceGuard $guard,
        private readonly TraceRepository $traces,
        private readonly SpanRepository $spans,
        private readonly FailureReporter $failures,
    ) {}

    public function recordLifecycle(LifecycleRecord $record): void
    {
        if ($this->guard->active()) {
            return;
        }

        $buffer = $record->type === Lifecycle::AttemptFinished && $record->attempt !== null
            ? $this->takeBuffer($record->runId, $record->attempt)
            : [];

        $this->persist(function () use ($record, $buffer): void {
            $this->database->get()->transaction(function () use ($record, $buffer): void {
                if ($buffer !== []) {
                    $this->spans->insertMany($buffer);
                }

                $this->traces->record($record);
            });
        });
    }

    public function recordSpan(SpanDataInterface $span): void
    {
        if ($this->guard->active()) {
            return;
        }

        $attributes = $span->getAttributes();
        $role = $attributes->get('skyline.role');
        $runId = $attributes->get('skyline.run_id');
        $attempt = $attributes->get('skyline.attempt');

        if ($role !== 'producer' && is_string($runId) && is_numeric($attempt)) {
            $this->spanBuffers[$this->bufferKey($runId, (int) $attempt)][] = $span;

            return;
        }

        $this->persist(fn () => $this->database->get()->transaction(
            fn () => $this->spans->insert($span),
        ));
    }

    private function persist(callable $callback): void
    {
        try {
            $this->guard->run($callback);
        } catch (Throwable $exception) {
            $this->failures->report($exception);
        }
    }

    /** @return list<SpanDataInterface> */
    private function takeBuffer(string $runId, int $attempt): array
    {
        $key = $this->bufferKey($runId, $attempt);
        $buffer = $this->spanBuffers[$key] ?? [];
        unset($this->spanBuffers[$key]);

        return $buffer;
    }

    private function bufferKey(string $runId, int $attempt): string
    {
        return $runId.':'.$attempt;
    }
}
