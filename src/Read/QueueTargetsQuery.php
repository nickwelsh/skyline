<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class QueueTargetsQuery
{
    private const PAGE_SIZE = 25;

    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    public function __construct(
        private SkylineConnection $database,
        private CursorCodec $cursors,
        private ApiMetadata $metadata,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = QueueTargetFilters::fromRequest($request);
        $connections = $this->connections();
        $this->validateConnection($filters, $connections);
        $rows = $this->applyTime($this->baseQuery(), $filters)->get();
        $groups = $rows->groupBy(fn (object $run): string => $run->connection."\0".$run->queue)
            ->when($filters->connection !== null, fn (Collection $groups) => $groups->filter(
                fn (Collection $runs) => $runs->first()->connection === $filters->connection,
            ))
            ->when($filters->search !== null, function (Collection $groups) use ($filters): Collection {
                $search = strtolower($filters->search);

                return $groups->filter(function (Collection $runs) use ($search): bool {
                    $run = $runs->first();

                    return str_contains(strtolower($run->connection), $search)
                        || str_contains(strtolower($run->queue), $search);
                });
            })->sortKeys()->values();

        [$groups, $previous, $next] = $this->targetPage($groups, $request->query('cursor'));

        return [
            ...$this->metadata->at($observedAt),
            'queueTargets' => $groups->map(fn (Collection $runs): array => $this->summary($runs))->all(),
            'pagination' => ['previous' => $previous, 'next' => $next],
            'filters' => $filters->toArray(),
            'options' => ['connections' => $connections],
            'hasAnyQueueTargets' => $this->baseQuery()->exists(),
        ];
    }

    /** @return array<string, mixed> */
    public function detail(Request $request, string $id): array
    {
        $observedAt = Nanoseconds::now();
        $filters = QueueTargetFilters::fromRequest($request, true);
        $target = $this->resolve($id);
        $targetQuery = $this->baseQuery()
            ->where('skyline_runs.connection', $target->connection)
            ->where('skyline_runs.queue', $target->queue);
        $seriesRows = $this->applyTime(clone $targetQuery, $filters)
            ->orderBy('skyline_runs.triggered_at')
            ->orderBy('skyline_runs.run_id')
            ->get();
        $runsQuery = $this->applyRunFilters($this->applyTime(clone $targetQuery, $filters), $filters);
        [$rows, $previous, $next] = $this->runPage($runsQuery, $request->query('cursor'), $id);

        return [
            ...$this->metadata->at($observedAt),
            'queueTarget' => $this->summary($seriesRows, $target),
            'series' => $this->series($seriesRows),
            'runs' => $this->runSummaries($rows, $observedAt),
            'pagination' => ['previous' => $previous, 'next' => $next],
            'filters' => $filters->toArray(),
            'options' => ['statuses' => self::STATUSES],
            'hasAnyRuns' => (clone $targetQuery)->exists(),
            'queueCapabilities' => [
                'pause' => false,
                'resume' => false,
                'concurrency' => false,
                'allocation' => false,
                'rateLimit' => false,
                'workers' => false,
                'billing' => false,
                'environmentControls' => false,
            ],
        ];
    }

    private function baseQuery(): Builder
    {
        return $this->connection()->table('skyline_runs')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->whereNotNull('skyline_runs.connection')
            ->whereNotNull('skyline_runs.queue')
            ->where('skyline_runs.connection', '<>', 'sync')
            ->where('skyline_runs.connection', '<>', '')
            ->where('skyline_runs.queue', '<>', '');
    }

    private function applyTime(Builder $query, QueueTargetFilters $filters): Builder
    {
        return $query
            ->when($filters->from !== null, fn (Builder $query) => $query->where('skyline_runs.triggered_at', '>=', $filters->from))
            ->when($filters->to !== null, fn (Builder $query) => $query->where('skyline_runs.triggered_at', '<=', $filters->to));
    }

    private function applyRunFilters(Builder $query, QueueTargetFilters $filters): Builder
    {
        return $query
            ->when($filters->statuses !== [], fn (Builder $query) => $query->whereIn('skyline_runs.status', $filters->statuses))
            ->when($filters->search !== null, function (Builder $query) use ($filters): void {
                $search = addcslashes($filters->search, '%_');
                $query->where(function (Builder $query) use ($search, $filters): void {
                    $query->whereRaw('LOWER(skyline_runs.job_name) LIKE ?', ['%'.strtolower($search).'%'])
                        ->orWhere('skyline_runs.run_id', $filters->search)
                        ->orWhere('skyline_runs.run_id', 'like', $search.'%');
                });
            });
    }

    /** @param list<string> $connections */
    private function validateConnection(QueueTargetFilters $filters, array $connections): void
    {
        if ($filters->connection !== null && ! in_array($filters->connection, $connections, true)) {
            throw new InvalidQuery('The connection filter is invalid.');
        }
    }

    /** @return list<string> */
    private function connections(): array
    {
        return $this->baseQuery()->distinct()->orderBy('connection')->pluck('connection')->all();
    }

    private function resolve(string $id): object
    {
        $target = $this->baseQuery()->select(['connection', 'queue'])->distinct()->get()->first(
            fn (object $target): bool => ObservedIds::queue($target->connection, $target->queue) === $id,
        );
        if ($target === null) {
            throw new RecordNotFound('The Queue target was not found.');
        }

        return $target;
    }

    /** @return array{Collection, ?string, ?string} */
    private function targetPage(Collection $groups, mixed $cursor): array
    {
        $direction = 'next';
        $boundary = null;
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'queue-targets');
            $direction = $decoded['direction'] ?? null;
            $boundary = $decoded['key'] ?? null;
            if (! in_array($direction, ['next', 'previous'], true) || ! is_string($boundary)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $groups = $groups->filter(function (Collection $runs) use ($direction, $boundary): bool {
                $first = $runs->first();
                $key = $first->connection."\0".$first->queue;

                return $direction === 'next' ? $key > $boundary : $key < $boundary;
            });
            if ($direction === 'previous') {
                $groups = $groups->reverse()->values();
            }
        }

        $page = $groups->take(self::PAGE_SIZE);
        if ($direction === 'previous') {
            $page = $page->reverse()->values();
        }
        $first = $page->first()?->first();
        $last = $page->last()?->first();
        $previous = $first !== null && $groups->contains(fn (Collection $runs) => ($runs->first()->connection."\0".$runs->first()->queue) < ($first->connection."\0".$first->queue))
            ? $this->targetCursor('previous', $first)
            : ($cursor !== null && $direction === 'next' ? $this->targetCursor('previous', $first) : null);
        $next = $last !== null && ($groups->count() > self::PAGE_SIZE || ($cursor !== null && $direction === 'previous'))
            ? $this->targetCursor('next', $last)
            : null;

        return [$page, $previous, $next];
    }

    private function targetCursor(string $direction, object $row): string
    {
        return $this->cursors->encode('queue-targets', [
            'direction' => $direction,
            'key' => $row->connection."\0".$row->queue,
        ]);
    }

    /** @return array{Collection, ?string, ?string} */
    private function runPage(Builder $query, mixed $cursor, string $targetId): array
    {
        $direction = 'next';
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'queue-target-runs');
            $direction = $decoded['direction'] ?? null;
            if (($decoded['targetId'] ?? null) !== $targetId
                || ! in_array($direction, ['next', 'previous'], true)
                || ! is_int($decoded['triggeredAt'] ?? null)
                || ! is_string($decoded['runId'] ?? null)
            ) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $this->applyRunBoundary($query, $direction, $decoded['triggeredAt'], $decoded['runId']);
        }

        $query->orderBy('skyline_runs.triggered_at', $direction === 'previous' ? 'asc' : 'desc')
            ->orderBy('skyline_runs.run_id', $direction === 'previous' ? 'asc' : 'desc');
        $rows = $query->limit(self::PAGE_SIZE + 1)->get();
        $hasMore = $rows->count() > self::PAGE_SIZE;
        $rows = $rows->take(self::PAGE_SIZE);
        if ($direction === 'previous') {
            $rows = $rows->reverse()->values();
        }
        $first = $rows->first();
        $last = $rows->last();
        $previous = $first !== null && (($direction === 'previous' && $hasMore) || ($cursor !== null && $direction === 'next'))
            ? $this->runCursor('previous', $first, $targetId)
            : null;
        $next = $last !== null && ($hasMore || ($cursor !== null && $direction === 'previous'))
            ? $this->runCursor('next', $last, $targetId)
            : null;

        return [$rows, $previous, $next];
    }

    private function applyRunBoundary(Builder $query, string $direction, int $triggeredAt, string $runId): void
    {
        $operator = $direction === 'previous' ? '>' : '<';
        $query->where(function (Builder $query) use ($operator, $triggeredAt, $runId): void {
            $query->where('skyline_runs.triggered_at', $operator, $triggeredAt)
                ->orWhere(function (Builder $query) use ($operator, $triggeredAt, $runId): void {
                    $query->where('skyline_runs.triggered_at', $triggeredAt)
                        ->where('skyline_runs.run_id', $operator, $runId);
                });
        });
    }

    private function runCursor(string $direction, object $row, string $targetId): string
    {
        return $this->cursors->encode('queue-target-runs', [
            'direction' => $direction,
            'targetId' => $targetId,
            'triggeredAt' => (int) $row->triggered_at,
            'runId' => $row->run_id,
        ]);
    }

    /** @return array<string, mixed> */
    private function summary(Collection $runs, ?object $target = null): array
    {
        $first = $runs->first() ?? $target;
        $times = $this->queueTimes($runs)->sort()->values();
        $counts = array_fill_keys(self::STATUSES, 0);
        foreach ($runs as $run) {
            if (array_key_exists($run->status, $counts)) {
                $counts[$run->status]++;
            }
        }

        return [
            'id' => ObservedIds::queue($first->connection, $first->queue),
            'connection' => $first->connection,
            'queue' => $first->queue,
            'firstObservedAt' => Nanoseconds::toRfc3339($runs->isEmpty() ? null : (int) $runs->min('triggered_at')),
            'lastObservedAt' => Nanoseconds::toRfc3339($runs->isEmpty() ? null : (int) $runs->max('triggered_at')),
            'recordedRunCount' => $runs->count(),
            'recordedRunCounts' => $counts,
            'queueTime' => [
                'sampleCount' => $times->count(),
                'medianUs' => $this->percentile($times, 0.5),
                'p95Us' => $this->percentile($times, 0.95),
                'maximumUs' => $times->isEmpty() ? null : intdiv((int) $times->max(), 1000),
            ],
        ];
    }

    /** @return array{activity: list<array<string, mixed>>, queueTime: list<array<string, mixed>>} */
    private function series(Collection $runs): array
    {
        $queueTimes = $this->queueTimes($runs, true);
        $activity = [];
        $waiting = [];
        foreach ($runs as $run) {
            $counts = array_fill_keys(self::STATUSES, 0);
            if (array_key_exists($run->status, $counts)) {
                $counts[$run->status] = 1;
            }
            $activity[] = [
                'timestamp' => Nanoseconds::toRfc3339((int) $run->triggered_at),
                'recordedRuns' => 1,
                'recordedRunCounts' => $counts,
            ];
            if (isset($queueTimes[$run->run_id])) {
                $durationUs = intdiv($queueTimes[$run->run_id], 1000);
                $waiting[] = [
                    'timestamp' => Nanoseconds::toRfc3339((int) $run->triggered_at),
                    'sampleCount' => 1,
                    'medianUs' => $durationUs,
                    'p95Us' => $durationUs,
                    'maximumUs' => $durationUs,
                ];
            }
        }

        return ['activity' => $activity, 'queueTime' => $waiting];
    }

    /** @return Collection<int|string, int> */
    private function queueTimes(Collection $runs, bool $keyed = false): Collection
    {
        if ($runs->isEmpty()) {
            return collect();
        }
        $attempts = $this->connection()->table('skyline_attempts')
            ->whereIn('run_id', $runs->pluck('run_id'))
            ->where('attempt_number', 1)
            ->pluck('queue_time_ns', 'run_id');

        return $runs->mapWithKeys(function (object $run) use ($attempts): array {
            $queueTime = $attempts->get($run->run_id);
            if ($queueTime === null && $run->started_at !== null && $run->queued_at !== null) {
                $queueTime = (int) $run->started_at - (int) $run->queued_at;
            }

            return $queueTime === null ? [] : [$run->run_id => max(0, (int) $queueTime)];
        })->when(! $keyed, fn (Collection $times) => $times->values());
    }

    private function percentile(Collection $nanoseconds, float $percentile): ?int
    {
        if ($nanoseconds->isEmpty()) {
            return null;
        }
        $position = ($nanoseconds->count() - 1) * $percentile;
        $lower = (int) floor($position);
        $upper = (int) ceil($position);
        $value = (float) $nanoseconds[$lower];
        if ($upper !== $lower) {
            $value += ((float) $nanoseconds[$upper] - $value) * ($position - $lower);
        }

        return (int) round($value / 1000);
    }

    /** @return list<array<string, mixed>> */
    private function runSummaries(Collection $runs, int $observedAt): array
    {
        if ($runs->isEmpty()) {
            return [];
        }
        $attempts = $this->connection()->table('skyline_attempts')
            ->whereIn('run_id', $runs->pluck('run_id'))
            ->orderBy('attempt_number')->get()->groupBy('run_id');
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');

        return $runs->map(function (object $run) use ($attempts, $observedAt, $basePath): array {
            $runAttempts = $attempts->get($run->run_id, collect());
            $firstAttempt = $runAttempts->first();
            $queueTime = $firstAttempt?->queue_time_ns;
            if ($queueTime === null && $run->started_at !== null && $run->queued_at !== null) {
                $queueTime = (int) $run->started_at - (int) $run->queued_at;
            }
            $terminal = in_array($run->status, ['completed', 'failed'], true);

            return [
                'id' => $run->run_id,
                'href' => $basePath.'/runs/'.rawurlencode($run->run_id),
                'traceId' => $run->trace_id,
                'name' => $run->job_name,
                'status' => $run->status,
                'attemptCount' => $runAttempts->count(),
                'triggeredAt' => Nanoseconds::toRfc3339((int) $run->triggered_at),
                'startedAt' => Nanoseconds::toRfc3339($run->started_at === null ? null : (int) $run->started_at),
                'finishedAt' => Nanoseconds::toRfc3339($run->finished_at === null ? null : (int) $run->finished_at),
                'queueDurationUs' => $queueTime === null ? null : intdiv((int) $queueTime, 1000),
                'durationUs' => $terminal && $run->started_at !== null && $run->finished_at !== null
                    ? intdiv((int) $run->finished_at - (int) $run->started_at, 1000)
                    : null,
                'activeDurationUs' => ! $terminal && $run->started_at !== null
                    ? intdiv($observedAt - (int) $run->started_at, 1000)
                    : null,
            ];
        })->all();
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
