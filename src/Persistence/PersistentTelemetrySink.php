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

    /** @var array<string, LifecycleRecord> */
    private array $dispatchBuffers = [];

    /** @var array<string, LifecycleRecord> */
    private array $processingBuffers = [];

    /** @var list<LifecycleRecord> */
    private array $lifecycleBatch = [];

    /** @var list<SpanDataInterface> */
    private array $spanBatch = [];

    private ?int $batchStartedAt = null;

    public function __construct(
        private readonly SkylineConnection $database,
        private readonly PersistenceGuard $guard,
        private readonly TelemetryBatchRepository $batch,
        private readonly FailureReporter $failures,
    ) {}

    public function recordLifecycle(LifecycleRecord $record): void
    {
        if ($this->guard->active()) {
            return;
        }

        if ($record->type === Lifecycle::RunDispatched) {
            $this->dispatchBuffers[$record->runId] = $record;

            return;
        }

        if ($record->type === Lifecycle::RunProcessing) {
            $this->processingBuffers[$this->bufferKey($record->runId, $record->attempt ?? 0)] = $record;

            return;
        }

        $buffer = $record->type === Lifecycle::AttemptFinished && $record->attempt !== null
            ? $this->takeBuffer($record->runId, $record->attempt)
            : [];
        $processing = $record->type === Lifecycle::AttemptStarted && $record->attempt !== null
            ? $this->takeProcessing($record->runId, $record->attempt)
            : null;
        if ($processing !== null) {
            $this->enqueueLifecycle($processing);
        }

        foreach ($buffer as $span) {
            $this->enqueueSpan($span);
        }

        $this->enqueueLifecycle($record);
        $this->flushAtLimit();
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

        if ($role === 'producer' && is_string($runId) && isset($this->dispatchBuffers[$runId])) {
            $dispatch = $this->dispatchBuffers[$runId];
            unset($this->dispatchBuffers[$runId]);
            $this->enqueueLifecycle($dispatch);
            $this->enqueueSpan($span);
            $this->flushAtLimit();

            return;
        }

        if ($role !== 'producer' && is_string($runId) && is_numeric($attempt)) {
            $this->spanBuffers[$this->bufferKey($runId, (int) $attempt)][] = $span;

            return;
        }

        $this->enqueueSpan($span);
        $this->flushAtLimit();
    }

    public function flushIfDue(): void
    {
        $delay = max(0, (int) config('skyline.batch.max_delay_ms', 2_000));

        if ($this->batchStartedAt !== null
            && hrtime(true) - $this->batchStartedAt >= $delay * 1_000_000
        ) {
            $this->flush();
        }
    }

    public function flush(): void
    {
        if ($this->lifecycleBatch === [] && $this->spanBatch === []) {
            return;
        }

        $lifecycle = $this->lifecycleBatch;
        $spans = $this->spanBatch;
        $this->lifecycleBatch = [];
        $this->spanBatch = [];
        $this->batchStartedAt = null;

        $this->persist(fn () => $this->database->get()->transaction(
            fn () => $this->batch->persist($lifecycle, $spans),
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

    private function takeProcessing(string $runId, int $attempt): ?LifecycleRecord
    {
        $key = $this->bufferKey($runId, $attempt);
        $record = $this->processingBuffers[$key] ?? null;
        unset($this->processingBuffers[$key]);

        return $record;
    }

    private function enqueueLifecycle(LifecycleRecord $record): void
    {
        $this->startBatch();
        $this->lifecycleBatch[] = $record;
    }

    private function enqueueSpan(SpanDataInterface $span): void
    {
        $this->startBatch();
        $this->spanBatch[] = $span;
    }

    private function startBatch(): void
    {
        $this->batchStartedAt ??= hrtime(true);
    }

    private function flushAtLimit(): void
    {
        $limit = max(1, (int) config('skyline.batch.max_operations', 5_000));

        if (count($this->lifecycleBatch) + count($this->spanBatch) >= $limit) {
            $this->flush();
        }
    }

    private function bufferKey(string $runId, int $attempt): string
    {
        return $runId.':'.$attempt;
    }
}
