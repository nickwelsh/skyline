<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

final readonly class TraceSnapshotQuery
{
    public function __construct(private SkylineConnection $database) {}

    public function get(string $runId): TraceSnapshot
    {
        for ($read = 0; $read < 2; $read++) {
            $snapshot = $this->read($runId);
            $revision = $this->database->get()->table('skyline_traces')
                ->where('trace_id', $snapshot->trace->trace_id)
                ->value('revision');

            if ((int) $revision === (int) $snapshot->trace->revision) {
                return $snapshot;
            }
        }

        throw new TraceChanged('The Trace changed while it was being read.');
    }

    private function read(string $runId): TraceSnapshot
    {
        $connection = $this->database->get();
        $selected = $connection->table('skyline_runs')
            ->where('run_id', $runId)
            ->whereNotNull('confirmed_at')
            ->first();

        if ($selected === null) {
            throw new RecordNotFound('The Run was not found.');
        }

        $trace = $connection->table('skyline_traces')->where('trace_id', $selected->trace_id)->first();

        if ($trace === null) {
            throw new RecordNotFound('The Trace was not found.');
        }

        $traceRuns = $connection->table('skyline_runs')
            ->where('trace_id', $selected->trace_id)
            ->whereNotNull('confirmed_at')
            ->orderBy('triggered_at')
            ->orderBy('run_id')
            ->get();
        $runIds = $this->descendants($traceRuns, $selected->run_id);
        $runs = $traceRuns->filter(fn (object $run): bool => isset($runIds[$run->run_id]))->values();
        $ids = $runs->pluck('run_id');
        $attempts = $connection->table('skyline_attempts')
            ->whereIn('run_id', $ids)
            ->orderBy('started_at')
            ->orderBy('attempt_number')
            ->get();
        $spans = $connection->table('skyline_spans')
            ->whereIn('run_id', $ids)
            ->orderBy('started_at')
            ->orderBy('span_id')
            ->get();

        return new TraceSnapshot($trace, $selected, $runs, $attempts, $spans);
    }

    /** @return array<string, true> */
    private function descendants(Collection $runs, string $selected): array
    {
        $included = [$selected => true];

        do {
            $changed = false;

            foreach ($runs as $run) {
                if (! isset($included[$run->run_id]) && isset($included[$run->parent_run_id ?? ''])) {
                    $included[$run->run_id] = true;
                    $changed = true;
                }
            }
        } while ($changed);

        return $included;
    }
}
