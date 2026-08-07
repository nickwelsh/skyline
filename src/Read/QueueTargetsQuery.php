<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class QueueTargetsQuery
{
    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    public function __construct(
        private SkylineConnection $database,
        private ApiMetadata $metadata,
        private QueueTargetPaginator $targets,
        private QueueTargetRunPage $runs,
        private QueueTargetStatistics $statistics,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = QueueTargetFilters::fromRequest($request);
        $connections = $this->connections();
        $this->validateConnection($filters, $connections);
        $rows = $this->applyTime($this->baseQuery(), $filters)->get();
        $environmentSummary = [
            'queued' => $rows->where('status', 'queued')->count(),
            'running' => $rows->where('status', 'running')->count(),
            'allocated' => null,
            'limit' => null,
        ];
        $groups = $rows->groupBy(fn (object $run): string => QueueTargetIdentity::fromRow($run)->groupKey())
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
            })->sort(fn (Collection $left, Collection $right): int => QueueTargetIdentity::fromRow($left->first())
            ->compare(QueueTargetIdentity::fromRow($right->first())))->values();

        [$groups, $previous, $next] = $this->targets->page($groups, $request->query('cursor'));

        return [
            ...$this->metadata->at($observedAt),
            'environmentSummary' => $environmentSummary,
            'queueTargets' => $groups->map(fn (Collection $runs): array => $this->statistics->summary($runs, QueueTargetIdentity::fromRow($runs->first())))->all(),
            'pagination' => ['previous' => $previous, 'next' => $next],
            'filters' => $filters->toArray(),
            'options' => ['connections' => $connections, 'timeRanges' => QueueTargetFilters::options()],
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
        $runPage = $this->runs->read($runsQuery, $request->query('cursor'), $target, $observedAt);

        return [
            ...$this->metadata->at($observedAt),
            'queueTarget' => $this->statistics->summary($seriesRows, $target),
            'series' => $this->statistics->series($seriesRows),
            'runs' => $runPage['runs'],
            'pagination' => $runPage['pagination'],
            'filters' => $filters->toArray(),
            'options' => ['statuses' => self::STATUSES, 'timeRanges' => QueueTargetFilters::options()],
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
        return QueueTargetEligibility::apply(
            $this->connection()->table('skyline_runs')->whereNotNull('skyline_runs.confirmed_at'),
        );
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
                $query->where(function (Builder $query) use ($filters): void {
                    PortableLike::whereContains($query, 'LOWER(skyline_runs.job_name)', strtolower($filters->search))
                        ->orWhere('skyline_runs.run_id', $filters->search);
                    PortableLike::orWherePrefix($query, 'skyline_runs.run_id', $filters->search);
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

    private function resolve(string $id): QueueTargetIdentity
    {
        $target = $this->baseQuery()->select(['connection', 'queue'])->distinct()->get()->first(
            fn (object $target): bool => QueueTargetIdentity::fromRow($target)->id() === $id,
        );
        if ($target === null) {
            throw new RecordNotFound('The Queue target was not found.');
        }

        return QueueTargetIdentity::fromRow($target);
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
