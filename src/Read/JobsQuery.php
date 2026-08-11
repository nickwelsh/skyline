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
        private ConsistentRead $consistentRead,
        private JobDefinition $definitions,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        return $this->consistentRead->run(fn (): array => $this->readPage($request));
    }

    /** @return array<string, mixed> */
    private function readPage(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = JobsFilters::fromRequest($request, $observedAt);
        [$jobNames, $previous, $next] = $this->jobNames($filters, $request->query('cursor'));
        $summaries = $this->summaries(
            $filters->apply($this->baseQuery())->whereIn('skyline_runs.job_name', $jobNames),
            $this->baseQuery()
                ->whereIn('skyline_runs.job_name', $jobNames)
                ->where('skyline_runs.triggered_at', '>=', $observedAt - 86_400_000_000_000),
            $jobNames,
        );

        return [
            ...$this->metadata->at($observedAt),
            'jobs' => $summaries,
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
        return $this->consistentRead->run(fn (): array => $this->readDetail($request, $jobId));
    }

    /** @return array<string, mixed> */
    private function readDetail(Request $request, string $jobId): array
    {
        $observedAt = Nanoseconds::now();
        $jobName = $this->jobName($jobId);
        $filterObservedAt = (intdiv($observedAt, 1_000_000_000) + 1) * 1_000_000_000 - 1;
        $filters = JobsFilters::fromRequest($request, $filterObservedAt, '7d');
        $runRequest = $this->runRequest($request, $jobName, $filters);
        $page = $this->runs->page($runRequest);
        $jobQuery = $this->baseQuery()->where('skyline_runs.job_name', $jobName);
        $job = $this->summaries(
            clone $jobQuery,
            (clone $jobQuery)->where('skyline_runs.triggered_at', '>=', $observedAt - 86_400_000_000_000),
            [$jobName],
        )[0];
        $activityRows = $filters->apply($this->baseQuery()->where('skyline_runs.job_name', $jobName));
        $statuses = $page['filters']['status'];
        if ($statuses !== []) {
            $activityRows->whereIn('skyline_runs.status', $statuses);
        }

        return [
            ...$this->metadata->at($observedAt),
            'job' => $job,
            'queueTargets' => $this->queueTargets(clone $jobQuery),
            'definition' => $this->definitions->for($jobName),
            'activity' => $this->activity($activityRows, $this->activityBucket($filters))->values()->all(),
            'activityRange' => [
                'from' => Nanoseconds::toRfc3339($filters->from ?? (int) $jobQuery->min('skyline_runs.triggered_at')),
                'to' => Nanoseconds::toRfc3339($filters->to ?? $observedAt),
            ],
            'runs' => $page['runs'],
            'pagination' => $page['pagination'],
            'tableState' => $page['tableState'],
            'filters' => [
                'status' => $page['filters']['status'],
                'period' => $filters->period,
                'from' => $filters->fromValue,
                'to' => $filters->toValue,
            ],
            'options' => [
                'statuses' => self::STATUSES,
                'timeRanges' => JobsFilters::options(),
            ],
            'hasAnyRuns' => (clone $jobQuery)->exists(),
        ];
    }

    private function baseQuery(): Builder
    {
        return $this->connection()->table('skyline_runs')->whereNotNull('skyline_runs.confirmed_at');
    }

    private function jobName(string $jobId): string
    {
        foreach ($this->baseQuery()->select('skyline_runs.job_name')->distinct()->cursor() as $candidate) {
            if (hash_equals(ObservedIds::job($candidate->job_name), $jobId)) {
                return $candidate->job_name;
            }
        }

        throw new RecordNotFound('The Job type was not found.');
    }

    private function runRequest(Request $request, string $jobName, JobsFilters $filters): Request
    {
        $query = $request->query();
        unset($query['search'], $query['period'], $query['from'], $query['to']);
        $query['job'] = $jobName;
        if ($filters->from !== null) {
            $query['triggeredFrom'] = Nanoseconds::toRfc3339($filters->from);
        }
        if ($filters->to !== null) {
            $query['triggeredTo'] = Nanoseconds::toRfc3339($filters->to);
        }

        return Request::create('/', 'GET', $query);
    }

    /** @param list<string> $jobNames @return list<array<string, mixed>> */
    private function summaries(Builder $summaryQuery, Builder $activityQuery, array $jobNames): array
    {
        if ($jobNames === []) {
            return [];
        }
        $latestQuery = clone $summaryQuery;
        $aggregates = $this->aggregate($summaryQuery)->keyBy('job_name');
        $latestRuns = $this->latestRuns($latestQuery)->keyBy('job_name');
        $activities = $this->activity($activityQuery, 3_600_000_000_000, true)->groupBy('jobName');

        return collect($jobNames)->map(function (string $jobName) use ($aggregates, $latestRuns, $activities): array {
            return $this->summary(
                $aggregates->get($jobName),
                $latestRuns->get($jobName),
                $activities->get($jobName, collect())->map(fn (array $point): array => collect($point)->except('jobName')->all())->all(),
            );
        })->all();
    }

    /** @param list<array<string, mixed>> $activity @return array<string, mixed> */
    private function summary(object $aggregate, object $latest, array $activity): array
    {
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');
        $id = ObservedIds::job($aggregate->job_name);

        return [
            'id' => $id,
            'name' => $aggregate->job_name,
            'href' => "{$basePath}/jobs/{$id}",
            'firstObservedAt' => Nanoseconds::toRfc3339((int) $aggregate->first_observed_at),
            'lastObservedAt' => Nanoseconds::toRfc3339((int) $aggregate->last_observed_at),
            'runCount' => (int) $aggregate->run_count,
            'statusCounts' => $this->statusCounts($aggregate),
            'activity' => $activity,
            'latestRun' => [
                'id' => $latest->run_id,
                'status' => $latest->status,
                'triggeredAt' => Nanoseconds::toRfc3339((int) $latest->triggered_at),
                'href' => "{$basePath}/runs/".rawurlencode($latest->run_id),
            ],
        ];
    }

    /** @return Collection<int, object> */
    private function aggregate(Builder $query): Collection
    {
        $query->select('skyline_runs.job_name')
            ->selectRaw('MIN(skyline_runs.triggered_at) AS first_observed_at')
            ->selectRaw('MAX(skyline_runs.triggered_at) AS last_observed_at')
            ->selectRaw('COUNT(*) AS run_count')
            ->groupBy('skyline_runs.job_name')
            ->orderBy('skyline_runs.job_name');
        $this->selectStatusCounts($query);

        return $query->get();
    }

    /** @return Collection<int, object> */
    private function latestRuns(Builder $query): Collection
    {
        $ranked = $query->select([
            'skyline_runs.job_name',
            'skyline_runs.run_id',
            'skyline_runs.status',
            'skyline_runs.triggered_at',
        ])->selectRaw('ROW_NUMBER() OVER (PARTITION BY skyline_runs.job_name ORDER BY skyline_runs.triggered_at DESC, skyline_runs.run_id DESC) AS job_rank');

        return $this->connection()->query()
            ->fromSub($ranked, 'ranked_jobs')
            ->where('job_rank', 1)
            ->get();
    }

    /** @return list<array<string, mixed>> */
    private function queueTargets(Builder $query): array
    {
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');

        return QueueTargetEligibility::apply($query)
            ->select(['skyline_runs.connection', 'skyline_runs.queue'])
            ->selectRaw('COUNT(*) AS run_count')
            ->groupBy(['skyline_runs.connection', 'skyline_runs.queue'])
            ->orderBy('skyline_runs.connection')
            ->orderBy('skyline_runs.queue')
            ->get()
            ->map(function (object $target) use ($basePath): array {
                $id = ObservedIds::queue($target->connection, $target->queue);

                return [
                    'id' => $id,
                    'connection' => $target->connection,
                    'queue' => $target->queue,
                    'runCount' => (int) $target->run_count,
                    'href' => "{$basePath}/queues/{$id}",
                ];
            })->all();
    }

    /** @return Collection<int, array<string, mixed>> */
    private function activity(Builder $query, int $bucketNanoseconds, bool $includeJob = false): Collection
    {
        $bucket = PortableActivityBucket::expression(
            $this->connection(),
            'skyline_runs.triggered_at',
            $bucketNanoseconds,
        );
        if ($includeJob) {
            $query->addSelect('skyline_runs.job_name')->groupBy('skyline_runs.job_name');
        }
        $query->selectRaw("{$bucket} AS activity_bucket")
            ->selectRaw('COUNT(*) AS run_count')
            ->groupByRaw($bucket)
            ->orderBy('activity_bucket');
        $this->selectStatusCounts($query);

        return $query->get()->map(fn (object $row): array => [
            ...$includeJob ? ['jobName' => $row->job_name] : [],
            'timestamp' => gmdate('Y-m-d\\TH:i:s\\Z', (int) $row->activity_bucket * intdiv($bucketNanoseconds, 1_000_000_000)),
            'total' => (int) $row->run_count,
            'statusCounts' => $this->statusCounts($row),
        ]);
    }

    private function selectStatusCounts(Builder $query): void
    {
        foreach (self::STATUSES as $status) {
            $query->selectRaw("SUM(CASE WHEN skyline_runs.status = ? THEN 1 ELSE 0 END) AS {$status}_count", [$status]);
        }
    }

    private function activityBucket(JobsFilters $filters): int
    {
        $duration = ($filters->to ?? Nanoseconds::now()) - ($filters->from ?? 0);

        return match (true) {
            $duration <= 15 * 60_000_000_000 => 10_000_000_000,
            $duration <= 2 * 3_600_000_000_000 => 60_000_000_000,
            $duration <= 2 * 86_400_000_000_000 => 3_600_000_000_000,
            $duration <= 90 * 86_400_000_000_000 => 86_400_000_000_000,
            default => 7 * 86_400_000_000_000,
        };
    }

    /** @return array<string, int> */
    private function statusCounts(object $row): array
    {
        return collect(self::STATUSES)->mapWithKeys(fn (string $status): array => [
            $status => (int) $row->{"{$status}_count"},
        ])->all();
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
