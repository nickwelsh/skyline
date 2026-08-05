<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class JobsQuery
{
    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    public function __construct(
        private SkylineConnection $database,
        private RunsQuery $runs,
        private ApiMetadata $metadata,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = JobsFilters::fromRequest($request, $observedAt);
        $rows = $filters->apply($this->baseQuery())
            ->orderBy('skyline_runs.job_name')
            ->orderByDesc('skyline_runs.triggered_at')
            ->orderByDesc('skyline_runs.run_id')
            ->get();

        return [
            ...$this->metadata->at($observedAt),
            'jobs' => $rows->groupBy('job_name')->map(fn (Collection $runs): array => $this->summary($runs))->values()->all(),
            'filters' => $filters->toArray(),
            'options' => ['timeRanges' => JobsFilters::options()],
            'hasAnyJobs' => $this->baseQuery()->exists(),
        ];
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
        $activityRows = $filters->apply($this->baseQuery()->where('skyline_runs.job_name', $jobName));
        $statuses = $page['filters']['status'];
        if ($statuses !== []) {
            $activityRows->whereIn('skyline_runs.status', $statuses);
        }

        return [
            ...$this->metadata->at($observedAt),
            'job' => $this->summary($allRows),
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

    /** @param Collection<int, object> $rows @return array<string, mixed> */
    private function summary(Collection $rows): array
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
    private function activity(Collection $rows): array
    {
        return $rows->groupBy(fn (object $run): string => gmdate('Y-m-d\T00:00:00\Z', intdiv((int) $run->triggered_at, 1_000_000_000)))
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
