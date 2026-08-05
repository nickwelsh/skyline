<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class QueueTargetRunPage
{
    private const PAGE_SIZE = 25;

    public function __construct(
        private SkylineConnection $database,
        private CursorCodec $cursors,
    ) {}

    /** @return array{runs: list<array<string, mixed>>, pagination: array{previous: ?string, next: ?string}} */
    public function read(Builder $query, mixed $cursor, QueueTargetIdentity $target, int $observedAt): array
    {
        $direction = 'next';
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'queue-target-runs');
            $direction = $decoded['direction'] ?? null;
            if (($decoded['targetId'] ?? null) !== $target->id()
                || ! in_array($direction, ['next', 'previous'], true)
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
        $hasMore = $rows->count() > self::PAGE_SIZE;
        $rows = $rows->take(self::PAGE_SIZE);
        if ($direction === 'previous') {
            $rows = $rows->reverse()->values();
        }
        $first = $rows->first();
        $last = $rows->last();
        $previous = $first !== null && (($direction === 'previous' && $hasMore) || ($cursor !== null && $direction === 'next'))
            ? $this->cursor('previous', $first, $target)
            : null;
        $next = $last !== null && ($hasMore || ($cursor !== null && $direction === 'previous'))
            ? $this->cursor('next', $last, $target)
            : null;

        return [
            'runs' => $this->summaries($rows, $observedAt),
            'pagination' => ['previous' => $previous, 'next' => $next],
        ];
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

    private function cursor(string $direction, object $row, QueueTargetIdentity $target): string
    {
        return $this->cursors->encode('queue-target-runs', [
            'direction' => $direction,
            'targetId' => $target->id(),
            'triggeredAt' => (int) $row->triggered_at,
            'runId' => $row->run_id,
        ]);
    }

    /** @param Collection<int, object> $runs @return list<array<string, mixed>> */
    private function summaries(Collection $runs, int $observedAt): array
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
