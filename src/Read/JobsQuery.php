<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class JobsQuery
{
    private const PAGE_SIZE = 25;

    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    public function __construct(
        private SkylineConnection $database,
        private RunsQuery $runs,
        private ApiMetadata $metadata,
        private CursorCodec $cursors,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = JobsFilters::fromRequest($request, $observedAt);
        [$jobNames, $previous, $next] = $this->jobNames($filters, $request->query('cursor'));
        $rows = $filters->apply($this->baseQuery())
            ->whereIn('skyline_runs.job_name', $jobNames)
            ->orderBy('skyline_runs.job_name')
            ->orderByDesc('skyline_runs.triggered_at')
            ->orderByDesc('skyline_runs.run_id')
            ->get();
        $recentActivity = $this->baseQuery()
            ->whereIn('skyline_runs.job_name', $jobNames)
            ->where('skyline_runs.triggered_at', '>=', $observedAt - 86_400_000_000_000)
            ->get()
            ->groupBy('job_name');

        return [
            ...$this->metadata->at($observedAt),
            'jobs' => $rows->groupBy('job_name')->map(fn (Collection $runs, string $jobName): array => $this->summary($runs, $recentActivity->get($jobName, collect())))->values()->all(),
            'pagination' => ['previous' => $previous, 'next' => $next],
            'filters' => $filters->toArray(),
            'options' => ['timeRanges' => JobsFilters::options()],
            'hasAnyJobs' => $this->baseQuery()->exists(),
        ];
    }

    /** @return array{list<string>, ?string, ?string} */
    private function jobNames(JobsFilters $filters, mixed $cursor): array
    {
        $direction = 'next';
        $boundary = null;
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'jobs');
            $direction = $decoded['direction'] ?? null;
            $boundary = $decoded['jobName'] ?? null;
            if (! in_array($direction, ['next', 'previous'], true)
                || ! is_string($boundary)
                || ($decoded['search'] ?? null) !== $filters->search
                || ($decoded['period'] ?? null) !== $filters->period) {
                throw new InvalidQuery('The cursor is invalid.');
            }
        }

        $query = $filters->apply($this->baseQuery())
            ->select('skyline_runs.job_name')
            ->distinct();
        if ($boundary !== null) {
            $query->where('skyline_runs.job_name', $direction === 'next' ? '>' : '<', $boundary);
        }
        $names = $query->orderBy('skyline_runs.job_name', $direction === 'previous' ? 'desc' : 'asc')
            ->limit(self::PAGE_SIZE + 1)
            ->pluck('skyline_runs.job_name')
            ->take(self::PAGE_SIZE);
        if ($direction === 'previous') {
            $names = $names->reverse()->values();
        }

        $first = $names->first();
        $last = $names->last();
        $previous = $first !== null && $this->hasJobNameBeyond($filters, $first, '<')
            ? $this->jobCursor('previous', $first, $filters)
            : null;
        $next = $last !== null && $this->hasJobNameBeyond($filters, $last, '>')
            ? $this->jobCursor('next', $last, $filters)
            : null;

        return [$names->all(), $previous, $next];
    }

    private function hasJobNameBeyond(JobsFilters $filters, string $jobName, string $operator): bool
    {
        return $filters->apply($this->baseQuery())
            ->where('skyline_runs.job_name', $operator, $jobName)
            ->exists();
    }

    private function jobCursor(string $direction, string $jobName, JobsFilters $filters): string
    {
        return $this->cursors->encode('jobs', [
            'direction' => $direction,
            'jobName' => $jobName,
            'search' => $filters->search,
            'period' => $filters->period,
        ]);
    }

    /** @return array<string, mixed> */
    public function detail(Request $request, string $jobId): array
    {
        $observedAt = Nanoseconds::now();
        $jobName = $this->jobName($jobId);
        $filters = JobsFilters::fromRequest($request, $observedAt);
        $runRequest = $this->runRequest($request, $jobName, $filters);
        $page = $this->runs->page($runRequest);
        $allRows = $this->baseQuery()->where('skyline_runs.job_name', $jobName)
            ->orderByDesc('skyline_runs.triggered_at')
            ->orderByDesc('skyline_runs.run_id')
            ->get();
        $recentActivity = $allRows->filter(fn (object $run): bool => $run->triggered_at >= $observedAt - 86_400_000_000_000);
        $activityRows = $filters->apply($this->baseQuery()->where('skyline_runs.job_name', $jobName));
        $statuses = $page['filters']['status'];
        if ($statuses !== []) {
            $activityRows->whereIn('skyline_runs.status', $statuses);
        }

        return [
            ...$this->metadata->at($observedAt),
            'job' => $this->summary($allRows, $recentActivity),
            'queueTargets' => $this->queueTargets($allRows),
            'activity' => $this->activity($activityRows->get()),
            'runs' => $page['runs'],
            'pagination' => $page['pagination'],
            'tableState' => $page['tableState'],
            'filters' => [
                'status' => $page['filters']['status'],
                'period' => $filters->period,
            ],
            'options' => [
                'statuses' => self::STATUSES,
                'timeRanges' => JobsFilters::options(),
            ],
            'hasAnyRuns' => $allRows->isNotEmpty(),
        ];
    }

    private function baseQuery(): Builder
    {
        return $this->connection()->table('skyline_runs')->whereNotNull('skyline_runs.confirmed_at');
    }

    private function jobName(string $jobId): string
    {
        $names = $this->baseQuery()->distinct()->pluck('skyline_runs.job_name');
        $name = $names->first(fn (string $name): bool => hash_equals(ObservedIds::job($name), $jobId));

        if (! is_string($name)) {
            throw new RecordNotFound('The Job type was not found.');
        }

        return $name;
    }

    private function runRequest(Request $request, string $jobName, JobsFilters $filters): Request
    {
        $query = $request->query();
        unset($query['search'], $query['period']);
        $query['job'] = $jobName;
        if ($filters->from !== null) {
            $query['triggeredFrom'] = Nanoseconds::toRfc3339($filters->from);
        }

        return Request::create('/', 'GET', $query);
    }

    /** @param Collection<int, object> $rows @param Collection<int, object> $recentActivity @return array<string, mixed> */
    private function summary(Collection $rows, Collection $recentActivity): array
    {
        $latest = $rows->sortByDesc(fn (object $run): string => sprintf('%020d:%s', $run->triggered_at, $run->run_id))->first();
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');
        $id = ObservedIds::job($latest->job_name);

        return [
            'id' => $id,
            'name' => $latest->job_name,
            'href' => "{$basePath}/jobs/{$id}",
            'firstObservedAt' => Nanoseconds::toRfc3339((int) $rows->min('triggered_at')),
            'lastObservedAt' => Nanoseconds::toRfc3339((int) $rows->max('triggered_at')),
            'runCount' => $rows->count(),
            'statusCounts' => $this->statusCounts($rows),
            'activity' => $this->activity($recentActivity, 'Y-m-d\\TH:00:00\\Z'),
            'latestRun' => [
                'id' => $latest->run_id,
                'status' => $latest->status,
                'triggeredAt' => Nanoseconds::toRfc3339((int) $latest->triggered_at),
                'href' => "{$basePath}/runs/".rawurlencode($latest->run_id),
            ],
        ];
    }

    /** @param Collection<int, object> $rows @return list<array<string, mixed>> */
    private function queueTargets(Collection $rows): array
    {
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');

        return $rows->filter(fn (object $run): bool => is_string($run->connection) && is_string($run->queue))
            ->groupBy(fn (object $run): string => $run->connection."\0".$run->queue)
            ->map(function (Collection $target) use ($basePath): array {
                $run = $target->first();
                $id = ObservedIds::queue($run->connection, $run->queue);

                return [
                    'id' => $id,
                    'connection' => $run->connection,
                    'queue' => $run->queue,
                    'runCount' => $target->count(),
                    'href' => "{$basePath}/queues/{$id}",
                ];
            })->sortBy(fn (array $target): string => $target['connection']."\0".$target['queue'])->values()->all();
    }

    /** @param Collection<int, object> $rows @return list<array<string, mixed>> */
    private function activity(Collection $rows, string $bucket = 'Y-m-d\\T00:00:00\\Z'): array
    {
        return $rows->groupBy(fn (object $run): string => gmdate($bucket, intdiv((int) $run->triggered_at, 1_000_000_000)))
            ->map(function (Collection $bucket, string $timestamp): array {
                return ['timestamp' => $timestamp, 'total' => $bucket->count(), 'statusCounts' => $this->statusCounts($bucket)];
            })->sortKeys()->values()->all();
    }

    /** @param Collection<int, object> $rows @return array<string, int> */
    private function statusCounts(Collection $rows): array
    {
        $counts = array_fill_keys(self::STATUSES, 0);
        foreach ($rows as $run) {
            if (array_key_exists($run->status, $counts)) {
                $counts[$run->status]++;
            }
        }

        return $counts;
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
