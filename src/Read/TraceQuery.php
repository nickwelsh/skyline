<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Http\Request;

final readonly class TraceQuery
{
    public function __construct(
        private TraceSnapshotQuery $snapshots,
        private TraceViewBuilder $builder,
        private ApiMetadata $metadata,
        private RunsQuery $runs,
    ) {}

    /** @return array<string, mixed> */
    public function get(string $runId, Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $snapshot = $this->snapshots->get($runId);

        return [
            ...$this->metadata->at($observedAt),
            ...$this->builder->build(
                $snapshot,
                $observedAt,
                max(1, (int) config('skyline.trace_node_limit', 25_000)),
                max(1, (int) config('skyline.trace_poll_node_limit', 1_000)),
            ),
            'navigation' => $this->runs->adjacent($request, $runId),
        ];
    }
}
