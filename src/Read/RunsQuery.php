<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class RunsQuery
{
    private const PAGE_SIZE = 25;

    private const ACTIVE_STATUSES = ['queued', 'running', 'retrying'];

    public function __construct(
        private SkylineConnection $database,
        private CursorCodec $cursors,
        private ApiMetadata $metadata,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = RunsFilters::fromRequest($request);
        $query = $filters->apply($this->baseQuery());
        $cursor = $request->query('cursor');
        $direction = 'next';

        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }

            $decoded = $this->cursors->decode($cursor, 'runs');
            $direction = $decoded['direction'] ?? null;

            if (! in_array($direction, ['next', 'previous'], true)
                || ! is_int($decoded['triggeredAt'] ?? null)
                || ! is_string($decoded['runId'] ?? null)
            ) {
                throw new InvalidQuery('The cursor is invalid.');
            }

            $this->applyBoundary($query, $direction, $decoded['triggeredAt'], $decoded['runId']);
        }

        $query->orderBy('skyline_runs.triggered_at', $direction === 'previous' ? 'asc' : 'desc')
            ->orderBy('skyline_runs.run_id', $direction === 'previous' ? 'asc' : 'desc');
        $rows = $query->limit(self::PAGE_SIZE + 1)->get();

        if ($rows->count() > self::PAGE_SIZE) {
            $rows = $rows->take(self::PAGE_SIZE);
        }

        if ($direction === 'previous') {
            $rows = $rows->reverse()->values();
        }

        $runs = $this->summaries($rows, $observedAt);
        $first = $rows->first();
        $last = $rows->last();

        return [
            ...$this->metadata->at($observedAt),
            'runs' => $runs,
            'pagination' => [
                'previous' => $first !== null && $this->existsBefore($filters, $first)
                    ? $this->cursor('previous', $first)
                    : null,
                'next' => $last !== null && $this->existsAfter($filters, $last)
                    ? $this->cursor('next', $last)
                    : null,
            ],
            'pollCursor' => $this->cursors->encode('runs-poll', ['observedAt' => $observedAt]),
            'polling' => ['activeRunsIntervalMs' => 3_000, 'newRunsIntervalMs' => 6_000],
            'tableState' => $this->cursors->encode('table-state', [
                'query' => $filters->toQuery(),
                'cursor' => is_string($cursor) ? $cursor : '',
            ]),
            'filters' => $filters->toArray(),
            'options' => $this->options(),
            'hasAnyRuns' => $this->baseQuery()->exists(),
        ];
    }

    /** @return array{previousRunId: ?string, nextRunId: ?string, tableState: string, listCursor: ?string} */
    public function adjacent(Request $request, string $runId): array
    {
        $tableState = $request->query('tableState');
        $state = null;

        if (is_string($tableState)) {
            try {
                $decoded = $this->cursors->decode($tableState, 'table-state');
                $query = $decoded['query'] ?? null;

                if (is_array($query) && is_string($decoded['cursor'] ?? null)) {
                    $state = $decoded;
                }
            } catch (InvalidQuery) {
                // Invalid navigation state falls back to the unfiltered list.
            }
        }

        $filterRequest = Request::create('/', 'GET', is_array($state['query'] ?? null) ? $state['query'] : []);
        $filters = RunsFilters::fromRequest($filterRequest);
        $current = $this->baseQuery()->where('skyline_runs.run_id', $runId)->first();

        if ($current === null) {
            throw new RecordNotFound('The Run was not found.');
        }

        $previous = $filters->apply($this->baseQuery());
        $this->applyBoundary($previous, 'previous', (int) $current->triggered_at, $current->run_id);
        $next = $filters->apply($this->baseQuery());
        $this->applyBoundary($next, 'next', (int) $current->triggered_at, $current->run_id);
        $encoded = $state !== null
            ? $tableState
            : $this->cursors->encode('table-state', ['query' => [], 'cursor' => '']);

        return [
            'previousRunId' => $previous->orderBy('skyline_runs.triggered_at')->orderBy('skyline_runs.run_id')->value('run_id'),
            'nextRunId' => $next->orderByDesc('skyline_runs.triggered_at')->orderByDesc('skyline_runs.run_id')->value('run_id'),
            'tableState' => $encoded,
            'listCursor' => is_string($state['cursor'] ?? null) && $state['cursor'] !== ''
                ? $state['cursor']
                : null,
        ];
    }

    /** @return array<string, mixed> */
    public function updates(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = RunsFilters::fromRequest($request);
        $cursor = $request->query('since');
        $since = $observedAt;

        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The polling cursor is invalid.');
            }

            $decoded = $this->cursors->decode($cursor, 'runs-poll');

            if (! is_int($decoded['observedAt'] ?? null)) {
                throw new InvalidQuery('The polling cursor is invalid.');
            }

            $since = $decoded['observedAt'];
        }

        $runIds = $this->pollRunIds($request);
        $active = $filters->apply($this->baseQuery(), $runIds === [])
            ->when(
                $runIds === [],
                fn (Builder $query) => $query->whereIn('skyline_runs.status', self::ACTIVE_STATUSES),
                fn (Builder $query) => $query->whereIn('skyline_runs.run_id', $runIds),
            )->where('skyline_traces.last_activity_at', '>', $since)
            ->orderByDesc('skyline_runs.triggered_at')
            ->orderByDesc('skyline_runs.run_id')
            ->limit(1000)
            ->get();
        $newRuns = $filters->apply($this->baseQuery())
            ->where('skyline_runs.confirmed_at', '>', $since)
            ->count();

        return [
            ...$this->metadata->at($observedAt),
            'runs' => $this->summaries($active, $observedAt),
            'newRunCount' => $newRuns,
            'pollCursor' => $this->cursors->encode('runs-poll', ['observedAt' => $observedAt]),
        ];
    }

    /** @return list<string> */
    private function pollRunIds(Request $request): array
    {
        $runIds = $request->query('runIds', []);

        if ($runIds === null || $runIds === '') {
            return [];
        }

        if (! is_array($runIds)
            || count($runIds) > self::PAGE_SIZE
            || array_filter($runIds, fn (mixed $runId): bool => ! is_string($runId) || $runId === '' || strlen($runId) > 64) !== []
        ) {
            throw new InvalidQuery('The Run polling selection is invalid.');
        }

        return array_values(array_unique($runIds));
    }

    private function baseQuery(): Builder
    {
        return $this->connection()->table('skyline_runs')
            ->join('skyline_traces', 'skyline_traces.trace_id', '=', 'skyline_runs.trace_id')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->select([
                'skyline_runs.*',
                'skyline_traces.root_run_id',
                'skyline_traces.revision',
                'skyline_traces.last_activity_at',
            ]);
    }

    private function applyBoundary(Builder $query, string $direction, int $triggeredAt, string $runId): void
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

    private function existsBefore(RunsFilters $filters, object $row): bool
    {
        $query = $filters->apply($this->baseQuery());
        $this->applyBoundary($query, 'previous', (int) $row->triggered_at, $row->run_id);

        return $query->exists();
    }

    private function existsAfter(RunsFilters $filters, object $row): bool
    {
        $query = $filters->apply($this->baseQuery());
        $this->applyBoundary($query, 'next', (int) $row->triggered_at, $row->run_id);

        return $query->exists();
    }

    private function cursor(string $direction, object $row): string
    {
        return $this->cursors->encode('runs', [
            'direction' => $direction,
            'triggeredAt' => (int) $row->triggered_at,
            'runId' => $row->run_id,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function summaries(Collection $rows, int $observedAt): array
    {
        if ($rows->isEmpty()) {
            return [];
        }

        $attempts = $this->connection()->table('skyline_attempts')
            ->whereIn('run_id', $rows->pluck('run_id'))
            ->orderBy('attempt_number')
            ->get()
            ->groupBy('run_id');

        return $rows->map(function (object $run) use ($attempts, $observedAt): array {
            $runAttempts = $attempts->get($run->run_id, collect());
            $firstAttempt = $runAttempts->first();
            $queueTime = $run->connection === 'sync'
                ? 0
                : ($firstAttempt?->queue_time_ns ?? ($run->started_at !== null && $run->queued_at !== null
                    ? (int) $run->started_at - (int) $run->queued_at
                    : null));
            $terminal = in_array($run->status, ['completed', 'failed'], true);

            return [
                'id' => $run->run_id,
                'traceId' => $run->trace_id,
                'isRoot' => $run->parent_run_id === null,
                'name' => $run->job_name,
                'status' => $run->status,
                'connection' => $run->connection,
                'queue' => $run->queue,
                'attemptCount' => $runAttempts->count(),
                'triggeredAt' => Nanoseconds::toRfc3339((int) $run->triggered_at),
                'queuedAt' => $run->connection === 'sync' ? null : Nanoseconds::toRfc3339(
                    $run->queued_at !== null
                        ? (int) $run->queued_at
                        : ($firstAttempt !== null && $queueTime !== null
                            ? (int) $firstAttempt->started_at - (int) $queueTime
                            : null),
                ),
                'startedAt' => Nanoseconds::toRfc3339($run->started_at === null ? null : (int) $run->started_at),
                'finishedAt' => Nanoseconds::toRfc3339($run->finished_at === null ? null : (int) $run->finished_at),
                'queueDurationUs' => $queueTime === null ? null : intdiv((int) $queueTime, 1000),
                'durationUs' => $terminal && $run->started_at !== null && $run->finished_at !== null
                    ? intdiv((int) $run->finished_at - (int) $run->started_at, 1000)
                    : null,
                'revision' => (int) $run->revision,
                'activeDurationUs' => ! $terminal && $run->started_at !== null
                    ? intdiv($observedAt - (int) $run->started_at, 1000)
                    : null,
            ];
        })->all();
    }

    /** @return array{statuses: list<string>, jobNames: list<string>, queueTargets: list<array{connection: string, queue: string}>, traceIdentities: list<string>} */
    private function options(): array
    {
        $query = $this->connection()->table('skyline_runs')->whereNotNull('confirmed_at');
        $jobNames = (clone $query)->whereNotNull('job_name')->distinct()->orderBy('job_name')->pluck('job_name')->all();
        $targets = (clone $query)->whereNotNull('connection')->whereNotNull('queue')
            ->select(['connection', 'queue'])->distinct()->orderBy('connection')->orderBy('queue')->get();

        return [
            'statuses' => ['queued', 'running', 'retrying', 'completed', 'failed'],
            'jobNames' => $jobNames,
            'queueTargets' => $targets->map(fn (object $target): array => [
                'connection' => $target->connection,
                'queue' => $target->queue,
            ])->all(),
            'traceIdentities' => (clone $query)->distinct()->orderBy('trace_id')->pluck('trace_id')->all(),
        ];
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
