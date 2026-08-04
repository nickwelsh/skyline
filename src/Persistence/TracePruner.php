<?php

namespace NickWelsh\Skyline\Persistence;

final readonly class TracePruner
{
    private const ACTIVE_STATUSES = ['queued', 'running', 'retrying'];

    public function __construct(private SkylineConnection $database) {}

    public function prune(int $retentionHours, int $chunkSize, ?int $now = null): int
    {
        $connection = $this->database->get();
        $cutoff = ($now ?? (int) round(microtime(true) * 1_000_000_000))
            - ($retentionHours * 3_600_000_000_000);
        $deleted = 0;

        do {
            $traceIds = $connection->table('skyline_traces')
                ->where('last_activity_at', '<', $cutoff)
                ->whereNotExists(function ($query): void {
                    $query->selectRaw('1')
                        ->from('skyline_runs')
                        ->whereColumn('skyline_runs.trace_id', 'skyline_traces.trace_id')
                        ->whereIn('skyline_runs.status', self::ACTIVE_STATUSES);
                })
                ->orderBy('last_activity_at')
                ->limit(max(1, $chunkSize))
                ->pluck('trace_id')
                ->all();

            if ($traceIds === []) {
                break;
            }

            $count = $connection->transaction(fn (): int => $connection->table('skyline_traces')
                ->whereIn('trace_id', $traceIds)
                ->where('last_activity_at', '<', $cutoff)
                ->whereNotExists(function ($query): void {
                    $query->selectRaw('1')
                        ->from('skyline_runs')
                        ->whereColumn('skyline_runs.trace_id', 'skyline_traces.trace_id')
                        ->whereIn('skyline_runs.status', self::ACTIVE_STATUSES);
                })
                ->delete());
            $deleted += $count;
        } while (count($traceIds) >= max(1, $chunkSize) && $count > 0);

        return $deleted;
    }
}
