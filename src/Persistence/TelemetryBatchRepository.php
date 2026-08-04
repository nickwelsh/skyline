<?php

namespace NickWelsh\Skyline\Persistence;

use NickWelsh\Skyline\Telemetry\Lifecycle;
use NickWelsh\Skyline\Telemetry\LifecycleRecord;
use OpenTelemetry\SDK\Trace\SpanDataInterface;

final readonly class TelemetryBatchRepository
{
    public function __construct(
        private SkylineConnection $database,
        private SpanRepository $spans,
    ) {}

    /**
     * @param  list<LifecycleRecord>  $lifecycle
     * @param  list<SpanDataInterface>  $spans
     */
    public function persist(array $lifecycle, array $spans): void
    {
        $connection = $this->database->get();
        $preparedSpans = $this->spans->prepareMany($spans);
        $runIds = array_values(array_unique(array_filter([
            ...array_map(static fn (LifecycleRecord $record): string => $record->runId, $lifecycle),
            ...array_column(array_column($preparedSpans, 'row'), 'run_id'),
        ], 'is_string')));
        $traceIds = array_values(array_unique(array_filter([
            ...array_map(static fn (LifecycleRecord $record): mixed => $record->attributes['trace_id'] ?? null, $lifecycle),
            ...array_column(array_column($preparedSpans, 'row'), 'trace_id'),
        ], 'is_string')));
        $runs = $connection->table('skyline_runs')->whereIn('run_id', $runIds)->get()
            ->mapWithKeys(static fn (object $run): array => [$run->run_id => (array) $run])->all();
        $existingRuns = $runs;
        $traceIds = array_values(array_unique([
            ...$traceIds,
            ...array_column($runs, 'trace_id'),
        ]));
        $attempts = $connection->table('skyline_attempts')->whereIn('run_id', $runIds)->get()
            ->mapWithKeys(static fn (object $attempt): array => [self::attemptKey($attempt->run_id, (int) $attempt->attempt_number) => (array) $attempt])->all();
        $existingAttempts = $attempts;
        $traces = $connection->table('skyline_traces')->whereIn('trace_id', $traceIds)->get()
            ->mapWithKeys(static fn (object $trace): array => [$trace->trace_id => (array) $trace])->all();
        $existingTraces = $traces;
        $activity = [];
        $runTraceIds = array_map(static fn (array $run): string => $run['trace_id'], $runs);
        $timestamp = now();

        foreach ($lifecycle as $record) {
            $traceId = self::stringAttribute($record, 'trace_id');

            if ($traceId !== null) {
                $runTraceIds[$record->runId] = $traceId;
            }
        }

        foreach ($preparedSpans as $entry) {
            $row = $entry['row'];
            $runTraceIds[$row['run_id']] = $row['trace_id'];
            $activity[$row['trace_id']] = max(
                $activity[$row['trace_id']] ?? 0,
                $row['ended_at'],
            );
        }

        foreach ($lifecycle as $record) {
            $traceId = $runTraceIds[$record->runId] ?? null;

            $changed = $this->applyLifecycle($runs, $attempts, $runTraceIds, $record, $timestamp);

            if ($traceId !== null && $changed) {
                $this->ensureTrace($traces, $traceId, $record, $timestamp);
                $activity[$traceId] = max($activity[$traceId] ?? 0, $record->observedAt);
            }
        }

        foreach ($preparedSpans as $entry) {
            $attributes = $entry['attributes'];
            $row = $entry['row'];
            $runId = $row['run_id'];
            $traceId = $row['trace_id'];
            $synthetic = new LifecycleRecord(
                Lifecycle::RunDispatched,
                $runId,
                null,
                $row['started_at'],
                [
                    'trace_id' => $traceId,
                    'parent_run_id' => $attributes['skyline.parent_run_id'] ?? null,
                    'job_name' => $attributes['laravel.job.name'] ?? null,
                ],
            );
            $this->ensureTrace($traces, $traceId, $synthetic, $timestamp);
            $this->ensureRun($runs, $runTraceIds, $synthetic, $timestamp);

            if (($attributes['skyline.role'] ?? null) === 'consumer'
                && is_numeric($attributes['skyline.attempt'] ?? null)
            ) {
                $attempt = (int) $attributes['skyline.attempt'];
                $key = self::attemptKey($runId, $attempt);
                $attempts[$key] ??= $this->newAttempt(
                    $runId,
                    $attempt,
                    $row['started_at'],
                    $timestamp,
                    is_numeric($attributes['skyline.queue_time_ms'] ?? null)
                        ? (int) round((float) $attributes['skyline.queue_time_ms'] * 1_000_000)
                        : null,
                    is_string($attributes['skyline.queue_time_source'] ?? null)
                        ? $attributes['skyline.queue_time_source']
                        : null,
                );
            }
        }

        foreach ($traces as $traceId => &$trace) {
            $latest = max((int) $trace['last_activity_at'], $activity[$traceId] ?? 0);
            $existing = $existingTraces[$traceId] ?? null;
            $trace['last_activity_at'] = $latest;
            $trace['revision'] = $existing === null
                ? 1
                : (int) $existing['revision'] + ($latest > (int) $existing['last_activity_at'] ? 1 : 0);
            $trace['updated_at'] = $timestamp;
        }
        unset($trace);

        if ($traces !== []) {
            if ($existingTraces === []) {
                $connection->table('skyline_traces')->insertOrIgnore(array_values($traces));
            } else {
                $connection->table('skyline_traces')->upsert(
                    array_values($traces),
                    ['trace_id'],
                    ['revision', 'last_activity_at', 'updated_at'],
                );
            }
        }

        if ($runs !== []) {
            if ($existingRuns === []) {
                $connection->table('skyline_runs')->insertOrIgnore(array_values($runs));
            } else {
                $connection->table('skyline_runs')->upsert(
                    array_values($runs),
                    ['run_id'],
                    [
                        'trace_id', 'parent_run_id', 'job_name', 'connection', 'queue', 'driver_id',
                        'status', 'triggered_at', 'queued_at', 'started_at', 'finished_at',
                        'queue_time_source', 'confirmed_at', 'updated_at',
                    ],
                );
            }
        }

        if ($attempts !== []) {
            $attemptRows = array_map(static function (array $attempt): array {
                unset($attempt['id']);

                return $attempt;
            }, array_values($attempts));
            if ($existingAttempts === []) {
                $connection->table('skyline_attempts')->insertOrIgnore($attemptRows);
            } else {
                $connection->table('skyline_attempts')->upsert(
                    $attemptRows,
                    ['run_id', 'attempt_number'],
                    [
                        'status', 'started_at', 'finished_at', 'queue_time_ns', 'queue_time_source',
                        'exception_class', 'exception_message', 'exception_code', 'exception_file',
                        'exception_line', 'exception_trace', 'updated_at',
                    ],
                );
            }
        }

        $this->spans->insertPrepared($preparedSpans, touchTraces: false);
    }

    /** @param array<string, array<string, mixed>> $traces */
    private function ensureTrace(array &$traces, string $traceId, LifecycleRecord $record, mixed $timestamp): void
    {
        $traces[$traceId] ??= [
            'trace_id' => $traceId,
            'root_run_id' => self::stringAttribute($record, 'parent_run_id') ?? $record->runId,
            'revision' => 1,
            'last_activity_at' => $record->observedAt,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $runs
     * @param  array<string, string>  $runTraceIds
     */
    private function ensureRun(array &$runs, array $runTraceIds, LifecycleRecord $record, mixed $timestamp): bool
    {
        if (isset($runs[$record->runId]) || ! isset($runTraceIds[$record->runId])) {
            return false;
        }

        $runs[$record->runId] = [
            'run_id' => $record->runId,
            'trace_id' => $runTraceIds[$record->runId],
            'parent_run_id' => self::stringAttribute($record, 'parent_run_id'),
            'job_name' => self::stringAttribute($record, 'job_name') ?? 'unknown',
            'connection' => self::stringAttribute($record, 'connection'),
            'queue' => self::stringAttribute($record, 'queue'),
            'driver_id' => null,
            'status' => 'dispatched',
            'triggered_at' => $record->observedAt,
            'queued_at' => null,
            'started_at' => null,
            'finished_at' => null,
            'queue_time_source' => null,
            'confirmed_at' => null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];

        return true;
    }

    /**
     * @param  array<string, array<string, mixed>>  $runs
     * @param  array<string, array<string, mixed>>  $attempts
     * @param  array<string, string>  $runTraceIds
     */
    private function applyLifecycle(
        array &$runs,
        array &$attempts,
        array $runTraceIds,
        LifecycleRecord $record,
        mixed $timestamp,
    ): bool {
        $changed = $this->ensureRun($runs, $runTraceIds, $record, $timestamp);

        if (! isset($runs[$record->runId])) {
            return false;
        }

        $run = &$runs[$record->runId];

        if ($record->type === Lifecycle::RunDispatched) {
            foreach (['job_name', 'connection', 'queue'] as $attribute) {
                if (($value = self::stringAttribute($record, $attribute)) !== null
                    && $run[$attribute] !== $value
                ) {
                    $run[$attribute] = $value;
                    $changed = true;
                }
            }
        } elseif ($record->type === Lifecycle::RunQueued && $run['status'] === 'dispatched') {
            $changed = true;
            $run['status'] = 'queued';
            $run['queued_at'] ??= $record->observedAt;
            $run['confirmed_at'] ??= $record->observedAt;

            foreach (['connection', 'queue', 'driver_id', 'queue_time_source'] as $attribute) {
                if (($value = self::stringAttribute($record, $attribute)) !== null) {
                    $run[$attribute] = $value;
                }
            }
        } elseif ($record->type === Lifecycle::RunProcessing
            && ! in_array($run['status'], ['completed', 'failed'], true)
        ) {
            $before = $run;
            $run['status'] = 'running';
            $run['started_at'] ??= $record->observedAt;
            $run['confirmed_at'] ??= $record->observedAt;

            foreach (['job_name', 'connection'] as $attribute) {
                if (($value = self::stringAttribute($record, $attribute)) !== null) {
                    $run[$attribute] = $value;
                }
            }

            $changed = $changed || $run !== $before;
        }

        if ($record->attempt !== null) {
            $key = self::attemptKey($record->runId, $record->attempt);

            if ($record->type === Lifecycle::AttemptStarted) {
                if (! isset($attempts[$key])) {
                    $attempts[$key] = $this->newAttempt(
                        $record->runId,
                        $record->attempt,
                        $record->observedAt,
                        $timestamp,
                        self::queueTime($record),
                        self::stringAttribute($record, 'queue_time_source'),
                    );
                    $changed = true;
                }
            } elseif ($record->type === Lifecycle::AttemptException && isset($attempts[$key])) {
                $attempt = &$attempts[$key];

                if ($attempt['exception_class'] === null) {
                    $changed = true;
                    foreach ([
                        'exception_class' => 'exception_type',
                        'exception_message' => 'exception_message',
                        'exception_code' => 'exception_code',
                        'exception_file' => 'exception_file',
                        'exception_line' => 'exception_line',
                        'exception_trace' => 'exception_trace',
                    ] as $column => $attribute) {
                        $attempt[$column] = $record->attributes[$attribute] ?? null;
                    }
                }
                unset($attempt);
            } elseif ($record->type === Lifecycle::AttemptFinished && isset($attempts[$key])) {
                $attempt = &$attempts[$key];

                if ($attempt['status'] === 'running') {
                    $changed = true;
                    $attempt['status'] = self::stringAttribute($record, 'attempt_outcome') ?? 'completed';
                    $attempt['finished_at'] = $record->observedAt;
                }
                unset($attempt);

                if (! in_array($run['status'], ['completed', 'failed'], true)) {
                    $changed = true;
                    $run['status'] = self::stringAttribute($record, 'run_status') ?? 'completed';
                    $run['finished_at'] = in_array($run['status'], ['completed', 'failed'], true)
                        ? $record->observedAt
                        : null;
                }
            }
        }

        if ($changed) {
            $run['updated_at'] = $timestamp;
        }
        unset($run);

        return $changed;
    }

    /** @return array<string, mixed> */
    private function newAttempt(
        string $runId,
        int $attempt,
        int $startedAt,
        mixed $timestamp,
        ?int $queueTime,
        ?string $queueTimeSource,
    ): array {
        return [
            'run_id' => $runId,
            'attempt_number' => $attempt,
            'status' => 'running',
            'started_at' => $startedAt,
            'finished_at' => null,
            'queue_time_ns' => $queueTime,
            'queue_time_source' => $queueTimeSource,
            'exception_class' => null,
            'exception_message' => null,
            'exception_code' => null,
            'exception_file' => null,
            'exception_line' => null,
            'exception_trace' => null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];
    }

    private static function attemptKey(string $runId, int $attempt): string
    {
        return $runId.':'.$attempt;
    }

    private static function stringAttribute(LifecycleRecord $record, string $key): ?string
    {
        $value = $record->attributes[$key] ?? null;

        return is_scalar($value) ? (string) $value : null;
    }

    private static function queueTime(LifecycleRecord $record): ?int
    {
        $milliseconds = $record->attributes['queue_time_ms'] ?? null;

        return is_numeric($milliseconds) ? (int) round((float) $milliseconds * 1_000_000) : null;
    }
}
