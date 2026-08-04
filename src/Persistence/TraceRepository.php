<?php

namespace NickWelsh\Skyline\Persistence;

use NickWelsh\Skyline\Telemetry\Lifecycle;
use NickWelsh\Skyline\Telemetry\LifecycleRecord;
use OpenTelemetry\SDK\Trace\SpanDataInterface;

final readonly class TraceRepository
{
    public function __construct(private SkylineConnection $database) {}

    public function record(LifecycleRecord $record): void
    {
        match ($record->type) {
            Lifecycle::RunDispatched => $this->dispatch($record),
            Lifecycle::RunQueued => $this->queue($record),
            Lifecycle::RunProcessing => $this->process($record),
            Lifecycle::AttemptStarted => $this->startAttempt($record),
            Lifecycle::AttemptException => $this->recordException($record),
            Lifecycle::AttemptFinished => $this->finishAttempt($record),
        };
    }

    public function ensureRun(
        string $traceId,
        string $runId,
        ?string $parentRunId,
        int $observedAt,
        string $jobName = 'unknown',
    ): bool {
        $connection = $this->database->get();
        $timestamp = now();
        $traceInserted = $connection->table('skyline_traces')->insertOrIgnore([
            'trace_id' => $traceId,
            'root_run_id' => $parentRunId ?? $runId,
            'revision' => 1,
            'last_activity_at' => $observedAt,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]) > 0;
        $runInserted = $connection->table('skyline_runs')->insertOrIgnore([
            'run_id' => $runId,
            'trace_id' => $traceId,
            'parent_run_id' => $parentRunId,
            'job_name' => $jobName,
            'status' => 'dispatched',
            'triggered_at' => $observedAt,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]) > 0;

        if ($runInserted && ! $traceInserted) {
            $this->touch($traceId, $observedAt);
        }

        return $traceInserted || $runInserted;
    }

    public function touch(string $traceId, int $observedAt): void
    {
        $connection = $this->database->get();

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $trace = $connection->table('skyline_traces')->where('trace_id', $traceId)->first();

            if ($trace === null) {
                return;
            }

            $changed = $connection->table('skyline_traces')
                ->where('trace_id', $traceId)
                ->where('revision', $trace->revision)
                ->update([
                    'revision' => (int) $trace->revision + 1,
                    'last_activity_at' => max((int) $trace->last_activity_at, $observedAt),
                    'updated_at' => now(),
                ]);

            if ($changed > 0) {
                return;
            }
        }
    }

    public function ensureAttemptFromSpan(SpanDataInterface $span): void
    {
        $attributes = $span->getAttributes();
        $runId = $attributes->get('skyline.run_id');
        $attempt = $attributes->get('skyline.attempt');

        if (! is_string($runId) || ! is_numeric($attempt)) {
            return;
        }

        $timestamp = now();
        $this->database->get()->table('skyline_attempts')->insertOrIgnore([
            'run_id' => $runId,
            'attempt_number' => (int) $attempt,
            'status' => 'running',
            'started_at' => $span->getStartEpochNanos(),
            'queue_time_ns' => is_numeric($attributes->get('skyline.queue_time_ms'))
                ? (int) round((float) $attributes->get('skyline.queue_time_ms') * 1_000_000)
                : null,
            'queue_time_source' => is_string($attributes->get('skyline.queue_time_source'))
                ? $attributes->get('skyline.queue_time_source')
                : null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    private function dispatch(LifecycleRecord $record): void
    {
        $traceId = $this->stringAttribute($record, 'trace_id');

        if ($traceId === null) {
            return;
        }

        $this->ensureRun(
            $traceId,
            $record->runId,
            $this->stringAttribute($record, 'parent_run_id'),
            $record->observedAt,
            $this->stringAttribute($record, 'job_name') ?? 'unknown',
        );

        $this->updateRun($record->runId, function (object $run) use ($record): array {
            $updates = [];

            foreach (['job_name', 'connection', 'queue'] as $attribute) {
                $value = $this->stringAttribute($record, $attribute);

                if ($value !== null && $run->{$attribute} !== $value) {
                    $updates[$attribute] = $value;
                }
            }

            return $updates;
        }, $record->observedAt);
    }

    private function queue(LifecycleRecord $record): void
    {
        $this->updateRun($record->runId, function (object $run) use ($record): array {
            $updates = [];

            if ($run->status === 'dispatched') {
                $updates['status'] = 'queued';
            }

            if ($run->queued_at === null) {
                $updates['queued_at'] = $record->observedAt;
            }

            if ($run->confirmed_at === null) {
                $updates['confirmed_at'] = $record->observedAt;
            }

            foreach (['connection', 'queue', 'driver_id', 'queue_time_source'] as $attribute) {
                $value = $this->stringAttribute($record, $attribute);

                if ($value !== null && $run->{$attribute} !== $value) {
                    $updates[$attribute] = $value;
                }
            }

            return $updates;
        }, $record->observedAt);
    }

    private function process(LifecycleRecord $record): void
    {
        $traceId = $this->stringAttribute($record, 'trace_id');

        if ($traceId !== null) {
            $this->ensureRun(
                $traceId,
                $record->runId,
                $this->stringAttribute($record, 'parent_run_id'),
                $record->observedAt,
                $this->stringAttribute($record, 'job_name') ?? 'unknown',
            );
        }

        $this->updateRun($record->runId, function (object $run) use ($record): array {
            $updates = [];

            if (! in_array($run->status, ['completed', 'failed'], true) && $run->status !== 'running') {
                $updates['status'] = 'running';
            }

            if ($run->started_at === null) {
                $updates['started_at'] = $record->observedAt;
            }

            if ($run->confirmed_at === null) {
                $updates['confirmed_at'] = $record->observedAt;
            }

            foreach (['job_name', 'connection'] as $attribute) {
                $value = $this->stringAttribute($record, $attribute);

                if ($value !== null && $run->{$attribute} !== $value) {
                    $updates[$attribute] = $value;
                }
            }

            return $updates;
        }, $record->observedAt);
    }

    private function startAttempt(LifecycleRecord $record): void
    {
        if ($record->attempt === null) {
            return;
        }

        $connection = $this->database->get();
        $timestamp = now();
        $inserted = $connection->table('skyline_attempts')->insertOrIgnore([
            'run_id' => $record->runId,
            'attempt_number' => $record->attempt,
            'status' => 'running',
            'started_at' => $record->observedAt,
            'queue_time_ns' => $this->queueTime($record),
            'queue_time_source' => $this->stringAttribute($record, 'queue_time_source'),
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]) > 0;

        if ($inserted) {
            $traceId = $this->traceId($record->runId);

            if ($traceId !== null) {
                $this->touch($traceId, $record->observedAt);
            }
        }
    }

    private function recordException(LifecycleRecord $record): void
    {
        if ($record->attempt === null) {
            return;
        }

        $connection = $this->database->get();
        $changed = $connection->table('skyline_attempts')
            ->where('run_id', $record->runId)
            ->where('attempt_number', $record->attempt)
            ->whereNull('exception_class')
            ->update([
                'exception_class' => $this->stringAttribute($record, 'exception_type'),
                'exception_message' => $this->stringAttribute($record, 'exception_message'),
                'exception_code' => $this->stringAttribute($record, 'exception_code'),
                'exception_file' => $this->stringAttribute($record, 'exception_file'),
                'exception_line' => $this->integerAttribute($record, 'exception_line'),
                'exception_trace' => $this->stringAttribute($record, 'exception_trace'),
                'updated_at' => now(),
            ]) > 0;

        if ($changed && ($traceId = $this->traceId($record->runId)) !== null) {
            $this->touch($traceId, $record->observedAt);
        }
    }

    private function finishAttempt(LifecycleRecord $record): void
    {
        if ($record->attempt === null) {
            return;
        }

        $connection = $this->database->get();
        $attemptOutcome = $this->stringAttribute($record, 'attempt_outcome') ?? 'completed';
        $runStatus = $this->stringAttribute($record, 'run_status') ?? 'completed';
        $attemptChanged = $connection->table('skyline_attempts')
            ->where('run_id', $record->runId)
            ->where('attempt_number', $record->attempt)
            ->where('status', 'running')
            ->update([
                'status' => $attemptOutcome,
                'finished_at' => $record->observedAt,
                'updated_at' => now(),
            ]) > 0;
        $runChanged = $connection->table('skyline_runs')
            ->where('run_id', $record->runId)
            ->whereNotIn('status', ['completed', 'failed'])
            ->update([
                'status' => $runStatus,
                'finished_at' => in_array($runStatus, ['completed', 'failed'], true)
                    ? $record->observedAt
                    : null,
                'updated_at' => now(),
            ]) > 0;

        if (($attemptChanged || $runChanged) && ($traceId = $this->traceId($record->runId)) !== null) {
            $this->touch($traceId, $record->observedAt);
        }
    }

    /** @param callable(object): array<string, mixed> $changes */
    private function updateRun(string $runId, callable $changes, int $observedAt): void
    {
        $connection = $this->database->get();
        $run = $connection->table('skyline_runs')->where('run_id', $runId)->first();

        if ($run === null || ($updates = $changes($run)) === []) {
            return;
        }

        $updates['updated_at'] = now();
        $changed = $connection->table('skyline_runs')
            ->where('run_id', $runId)
            ->where('status', $run->status)
            ->update($updates) > 0;

        if ($changed) {
            $this->touch($run->trace_id, $observedAt);
        }
    }

    private function traceId(string $runId): ?string
    {
        $traceId = $this->database->get()->table('skyline_runs')->where('run_id', $runId)->value('trace_id');

        return is_string($traceId) ? $traceId : null;
    }

    private function stringAttribute(LifecycleRecord $record, string $key): ?string
    {
        $value = $record->attributes[$key] ?? null;

        return is_scalar($value) ? (string) $value : null;
    }

    private function integerAttribute(LifecycleRecord $record, string $key): ?int
    {
        $value = $record->attributes[$key] ?? null;

        return is_numeric($value) ? (int) $value : null;
    }

    private function queueTime(LifecycleRecord $record): ?int
    {
        $milliseconds = $record->attributes['queue_time_ms'] ?? null;

        return is_numeric($milliseconds) ? (int) round((float) $milliseconds * 1_000_000) : null;
    }
}
