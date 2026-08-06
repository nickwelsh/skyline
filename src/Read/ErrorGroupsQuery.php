<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class ErrorGroupsQuery
{
    private const PAGE_SIZE = 25;

    public function __construct(
        private SkylineConnection $database,
        private ExceptionPresenter $exceptions,
        private ErrorGroupFingerprint $fingerprints,
        private CursorCodec $cursors,
        private ApiMetadata $metadata,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = ErrorGroupsFilters::fromRequest($request, $observedAt, '24h');
        $rows = $filters->apply($this->baseQuery())
            ->orderByDesc('skyline_attempts.started_at')
            ->orderByDesc('skyline_attempts.run_id')
            ->orderByDesc('skyline_attempts.attempt_number')
            ->get();
        $groups = $this->groups($rows)
            ->sort($this->compareGroups(...))
            ->values();
        $page = $this->groupPage($request, $groups, $filters);

        return [
            ...$this->metadata->at($observedAt),
            'errorGroups' => $page['groups']->map($this->summary(...))->values()->all(),
            'pagination' => $page['pagination'],
            'filters' => $filters->toArray(),
            'options' => $this->options(),
            'hasAnyErrorGroups' => $this->baseQuery()->exists(),
        ];
    }

    /** @return array<string, mixed> */
    public function detail(Request $request, string $errorId): array
    {
        $observedAt = Nanoseconds::now();
        $filters = ErrorGroupsFilters::fromRequest($request, $observedAt, '7d');
        $group = $this->groups(
            $this->baseQuery()
                ->orderByDesc('skyline_attempts.started_at')
                ->orderByDesc('skyline_attempts.run_id')
                ->orderByDesc('skyline_attempts.attempt_number')
                ->get(),
        )->first(fn (Collection $occurrences): bool => $occurrences->first()['id'] === $errorId);

        if (! $group instanceof Collection) {
            throw new RecordNotFound('The Error group was not found.');
        }

        $filtered = $group->filter(fn (array $occurrence): bool => $filters->from === null
            || $this->observedAt($occurrence['row']) >= $filters->from)->values();
        $page = $this->occurrencePage($request, $filtered);

        return [
            ...$this->metadata->at($observedAt),
            'errorGroup' => $this->summary($group),
            'representative' => $group->first()['exception'],
            'activity' => $this->activity($filtered),
            'failedAttempts' => $page['occurrences']->map($this->attempt(...))->all(),
            'pagination' => $page['pagination'],
            'filters' => ['period' => $filters->period],
            'options' => ['timeRanges' => JobsFilters::options()],
            'hasAnyOccurrences' => $group->isNotEmpty(),
        ];
    }

    private function baseQuery(): Builder
    {
        return $this->connection()->table('skyline_attempts')
            ->join('skyline_runs', 'skyline_runs.run_id', '=', 'skyline_attempts.run_id')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->where('skyline_attempts.status', 'failed')
            ->whereNotNull('skyline_attempts.exception_class')
            ->select(['skyline_attempts.*', 'skyline_runs.job_name']);
    }

    /** @param Collection<int, object> $rows @return Collection<string, Collection<int, array<string, mixed>>> */
    private function groups(Collection $rows): Collection
    {
        return $rows->map(function (object $row): array {
            $exception = $this->exceptions->present($row, $row->job_name);

            return [
                'row' => $row,
                'exception' => $exception,
                ...$this->fingerprints->identify($row->job_name, $exception),
            ];
        })->groupBy('fingerprint');
    }

    /** @param Collection<int, array<string, mixed>> $occurrences @return array<string, mixed> */
    private function summary(Collection $occurrences): array
    {
        $latest = $occurrences->first();
        $row = $latest['row'];
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');
        $id = $latest['id'];
        $attemptNode = NodeIds::attempt($row->run_id, (int) $row->attempt_number);

        return [
            'id' => $id,
            'fingerprint' => $latest['fingerprint'],
            'href' => "{$basePath}/errors/{$id}",
            'jobType' => $row->job_name,
            'jobId' => ObservedIds::job($row->job_name),
            'jobHref' => "{$basePath}/jobs/".ObservedIds::job($row->job_name),
            'exceptionClass' => $latest['exception']['class'],
            'representativeMessage' => $latest['exception']['message'],
            'firstObservedAt' => Nanoseconds::toRfc3339((int) $occurrences->min(fn (array $occurrence): int => $this->observedAt($occurrence['row']))),
            'lastObservedAt' => Nanoseconds::toRfc3339((int) $occurrences->max(fn (array $occurrence): int => $this->observedAt($occurrence['row']))),
            'occurrenceCount' => $occurrences->count(),
            'activity' => $this->activity($occurrences),
            'latest' => [
                'runId' => $row->run_id,
                'attemptNumber' => (int) $row->attempt_number,
                'observedAt' => Nanoseconds::toRfc3339($this->observedAt($row)),
                'runHref' => "{$basePath}/runs/".rawurlencode($row->run_id),
                'attemptHref' => "{$basePath}/runs/".rawurlencode($row->run_id).'?node='.rawurlencode($attemptNode),
            ],
        ];
    }

    private function observedAt(object $row): int
    {
        return (int) ($row->finished_at ?? $row->started_at);
    }

    /** @param Collection<int, Collection<int, array<string, mixed>>> $groups @return array{groups: Collection<int, Collection<int, array<string, mixed>>>, pagination: array{next: ?string, previous: ?string}} */
    private function groupPage(Request $request, Collection $groups, ErrorGroupsFilters $filters): array
    {
        $all = $groups;
        $cursor = $request->query('cursor');
        $direction = 'next';

        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'error-groups');
            $direction = $decoded['direction'] ?? null;
            if (! in_array($direction, ['next', 'previous'], true)
                || ! is_int($decoded['lastObservedAt'] ?? null)
                || ! is_string($decoded['fingerprint'] ?? null)
                || ($decoded['filters'] ?? null) !== $this->filterKey($filters)
            ) {
                throw new InvalidQuery('The cursor is invalid.');
            }

            $groups = $groups->filter(function (Collection $group) use ($decoded, $direction): bool {
                $comparison = $this->compareGroupToCursor($group, $decoded);

                return $direction === 'previous' ? $comparison < 0 : $comparison > 0;
            })->values();
            if ($direction === 'previous') {
                $groups = $groups->take(-self::PAGE_SIZE)->values();
            }
        }

        $page = $direction === 'previous' ? $groups : $groups->take(self::PAGE_SIZE)->values();
        $first = $page->first();
        $last = $page->last();

        return [
            'groups' => $page,
            'pagination' => [
                'previous' => $first !== null && $all->contains(fn (Collection $group): bool => $this->compareGroups($group, $first) < 0)
                    ? $this->groupCursor('previous', $first, $filters)
                    : null,
                'next' => $last !== null && $all->contains(fn (Collection $group): bool => $this->compareGroups($group, $last) > 0)
                    ? $this->groupCursor('next', $last, $filters)
                    : null,
            ],
        ];
    }

    /** @param Collection<int, array<string, mixed>> $occurrences @return array{occurrences: Collection<int, array<string, mixed>>, pagination: array{next: ?string, previous: ?string}} */
    private function occurrencePage(Request $request, Collection $occurrences): array
    {
        $all = $occurrences;
        $cursor = $request->query('cursor');
        $direction = 'next';

        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'error-occurrences');
            $direction = $decoded['direction'] ?? null;
            if (! in_array($direction, ['next', 'previous'], true)
                || ! is_int($decoded['observedAt'] ?? null)
                || ! is_string($decoded['runId'] ?? null)
                || ! is_int($decoded['attemptNumber'] ?? null)
            ) {
                throw new InvalidQuery('The cursor is invalid.');
            }

            $occurrences = $occurrences->filter(function (array $occurrence) use ($decoded, $direction): bool {
                $comparison = $this->compareToCursor($occurrence, $decoded);

                return $direction === 'previous' ? $comparison < 0 : $comparison > 0;
            })->values();
            if ($direction === 'previous') {
                $occurrences = $occurrences->take(-self::PAGE_SIZE)->values();
            }
        }

        $rows = $direction === 'previous' ? $occurrences : $occurrences->take(self::PAGE_SIZE)->values();
        $first = $rows->first();
        $last = $rows->last();

        return [
            'occurrences' => $rows,
            'pagination' => [
                'previous' => $first !== null && $all->contains(fn (array $occurrence): bool => $this->compare($occurrence, $first) < 0)
                    ? $this->occurrenceCursor('previous', $first)
                    : null,
                'next' => $last !== null && $all->contains(fn (array $occurrence): bool => $this->compare($occurrence, $last) > 0)
                    ? $this->occurrenceCursor('next', $last)
                    : null,
            ],
        ];
    }

    /** @param Collection<int, array<string, mixed>> $occurrences @return list<array{timestamp: string, occurrences: int}> */
    private function activity(Collection $occurrences): array
    {
        return $occurrences->groupBy(fn (array $occurrence): string => gmdate('Y-m-d\T00:00:00\Z', intdiv($this->observedAt($occurrence['row']), 1_000_000_000)))
            ->map(fn (Collection $bucket, string $timestamp): array => ['timestamp' => $timestamp, 'occurrences' => $bucket->count()])
            ->sortKeys()->values()->all();
    }

    /** @param array<string, mixed> $occurrence @return array<string, mixed> */
    private function attempt(array $occurrence): array
    {
        $row = $occurrence['row'];
        $basePath = '/'.trim((string) config('skyline.path', 'skyline'), '/');
        $id = NodeIds::attempt($row->run_id, (int) $row->attempt_number);

        return [
            'id' => $id,
            'runId' => $row->run_id,
            'attemptNumber' => (int) $row->attempt_number,
            'jobType' => $row->job_name,
            'startedAt' => Nanoseconds::toRfc3339((int) $row->started_at),
            'finishedAt' => Nanoseconds::toRfc3339($row->finished_at === null ? null : (int) $row->finished_at),
            'observedAt' => Nanoseconds::toRfc3339($this->observedAt($row)),
            'runHref' => "{$basePath}/runs/".rawurlencode($row->run_id),
            'attemptHref' => "{$basePath}/runs/".rawurlencode($row->run_id).'?node='.rawurlencode($id),
            'exception' => $occurrence['exception'],
        ];
    }

    /** @param array<string, mixed> $occurrence @param array<string, mixed> $cursor */
    private function compareToCursor(array $occurrence, array $cursor): int
    {
        $row = $occurrence['row'];
        $value = ['observedAt' => $this->observedAt($row), 'runId' => $row->run_id, 'attemptNumber' => (int) $row->attempt_number];

        return $this->compareTuple($value, $cursor);
    }

    /** @param array<string, mixed> $left @param array<string, mixed> $right */
    private function compare(array $left, array $right): int
    {
        $leftRow = $left['row'];
        $rightRow = $right['row'];

        return $this->compareTuple(
            ['observedAt' => $this->observedAt($leftRow), 'runId' => $leftRow->run_id, 'attemptNumber' => (int) $leftRow->attempt_number],
            ['observedAt' => $this->observedAt($rightRow), 'runId' => $rightRow->run_id, 'attemptNumber' => (int) $rightRow->attempt_number],
        );
    }

    /** @param array<string, mixed> $left @param array<string, mixed> $right */
    private function compareTuple(array $left, array $right): int
    {
        return [$right['observedAt'], $right['runId'], $right['attemptNumber']] <=> [$left['observedAt'], $left['runId'], $left['attemptNumber']];
    }

    /** @param Collection<int, array<string, mixed>> $left @param Collection<int, array<string, mixed>> $right */
    private function compareGroups(Collection $left, Collection $right): int
    {
        $time = $this->groupObservedAt($right) <=> $this->groupObservedAt($left);

        return $time !== 0 ? $time : strcmp($left->first()['fingerprint'], $right->first()['fingerprint']);
    }

    /** @param Collection<int, array<string, mixed>> $group @param array<string, mixed> $cursor */
    private function compareGroupToCursor(Collection $group, array $cursor): int
    {
        $time = $cursor['lastObservedAt'] <=> $this->groupObservedAt($group);

        return $time !== 0 ? $time : strcmp($group->first()['fingerprint'], $cursor['fingerprint']);
    }

    /** @param Collection<int, array<string, mixed>> $group */
    private function groupObservedAt(Collection $group): int
    {
        return (int) $group->max(fn (array $occurrence): int => $this->observedAt($occurrence['row']));
    }

    /** @param Collection<int, array<string, mixed>> $group */
    private function groupCursor(string $direction, Collection $group, ErrorGroupsFilters $filters): string
    {
        return $this->cursors->encode('error-groups', [
            'direction' => $direction,
            'lastObservedAt' => $this->groupObservedAt($group),
            'fingerprint' => $group->first()['fingerprint'],
            'filters' => $this->filterKey($filters),
        ]);
    }

    private function filterKey(ErrorGroupsFilters $filters): string
    {
        return hash('sha256', json_encode($filters->toArray(), JSON_THROW_ON_ERROR));
    }

    /** @param array<string, mixed> $occurrence */
    private function occurrenceCursor(string $direction, array $occurrence): string
    {
        $row = $occurrence['row'];

        return $this->cursors->encode('error-occurrences', [
            'direction' => $direction,
            'observedAt' => $this->observedAt($row),
            'runId' => $row->run_id,
            'attemptNumber' => (int) $row->attempt_number,
        ]);
    }

    /** @return array<string, mixed> */
    private function options(): array
    {
        $query = $this->baseQuery();

        return [
            'jobTypes' => (clone $query)->select('skyline_runs.job_name')->distinct()->orderBy('skyline_runs.job_name')->pluck('skyline_runs.job_name')->all(),
            'exceptionClasses' => (clone $query)->select('skyline_attempts.exception_class')->distinct()->orderBy('skyline_attempts.exception_class')->pluck('skyline_attempts.exception_class')->all(),
            'timeRanges' => JobsFilters::options(),
        ];
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
