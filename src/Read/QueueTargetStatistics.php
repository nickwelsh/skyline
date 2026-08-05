<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class QueueTargetStatistics
{
    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    public function __construct(private SkylineConnection $database) {}

    /** @param Collection<int, object> $runs @return array<string, mixed> */
    public function summary(Collection $runs, QueueTargetIdentity $target): array
    {
        $times = $this->queueTimes($runs)->sort()->values();
        $counts = array_fill_keys(self::STATUSES, 0);
        foreach ($runs as $run) {
            if (array_key_exists($run->status, $counts)) {
                $counts[$run->status]++;
            }
        }

        return [
            'id' => $target->id(),
            'connection' => $target->connection,
            'queue' => $target->queue,
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

    /** @param Collection<int, object> $runs @return array{activity: list<array<string, mixed>>, queueTime: list<array<string, mixed>>} */
    public function series(Collection $runs): array
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

    /** @param Collection<int, object> $runs @return Collection<int|string, int> */
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

    /** @param Collection<int, int> $nanoseconds */
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

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
