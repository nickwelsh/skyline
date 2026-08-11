<?php

namespace NickWelsh\Skyline\Read;

use NickWelsh\Skyline\Support\PrivacySanitizer;
use NickWelsh\Skyline\Support\Utf8;

final class TraceViewBuilder
{
    /** @return array{run: array<string, mixed>, trace: array<string, mixed>} */
    public function build(TraceSnapshot $snapshot, int $observedAt, int $limit, int $pollLimit): array
    {
        $selected = $snapshot->selectedRun;
        $rootId = NodeIds::run($selected->run_id);
        $nodes = $this->nodes($snapshot, $observedAt);
        $children = [];

        foreach ($nodes as $id => $node) {
            if ($node['parentId'] !== null && isset($nodes[$node['parentId']])) {
                $children[$node['parentId']][] = $id;
            }
        }

        foreach ($children as &$ids) {
            usort($ids, fn (string $left, string $right): int => [
                $nodes[$left]['_startedAt'],
                $left,
            ] <=> [
                $nodes[$right]['_startedAt'],
                $right,
            ]);
        }

        unset($ids);
        $this->markErrors($rootId, $nodes, $children);
        $ordered = [];
        $this->flatten($rootId, 0, $nodes, $children, $ordered);
        $nodeCount = count($ordered);
        $ordered = array_slice($ordered, 0, max(1, $limit));

        foreach ($ordered as &$node) {
            unset($node['_startedAt']);
            $node['inspectorHref'] = $this->nodeHref($selected->run_id, $node['id']);
            $node['telemetryEventHref'] = in_array($node['kind'], ['run', 'attempt'], true)
                ? null
                : $node['inspectorHref'];
        }

        unset($node);
        $attempts = $snapshot->attempts->where('run_id', $selected->run_id)->values();
        $firstAttempt = $attempts->first();
        $queueTime = $selected->connection === 'sync'
            ? 0
            : ($firstAttempt?->queue_time_ns ?? ($selected->started_at !== null && $selected->queued_at !== null
                ? (int) $selected->started_at - (int) $selected->queued_at
                : null));
        $terminal = in_array($selected->status, ['completed', 'failed'], true);
        $pollUntil = $terminal && $selected->finished_at !== null
            ? (int) $selected->finished_at + 30_000_000_000
            : null;
        $attemptViews = $attempts->map(function (object $attempt) use ($selected): array {
            $sanitizer = new PrivacySanitizer;
            $message = $attempt->exception_message === null
                ? null
                : $sanitizer->string(
                    (string) $attempt->exception_message,
                    max(1, (int) config('skyline.privacy.exception_message_bytes', 16_384)),
                    'attempt.failure.message',
                );

            return [
                'id' => NodeIds::attempt($attempt->run_id, (int) $attempt->attempt_number),
                'number' => (int) $attempt->attempt_number,
                'status' => $attempt->status,
                'startedAt' => Nanoseconds::toRfc3339((int) $attempt->started_at),
                'finishedAt' => Nanoseconds::toRfc3339($attempt->finished_at === null ? null : (int) $attempt->finished_at),
                'queueDurationUs' => $attempt->queue_time_ns === null ? null : intdiv((int) $attempt->queue_time_ns, 1000),
                'queueTimeSource' => $attempt->queue_time_source,
                'failure' => $attempt->exception_class === null ? null : [
                    'class' => $attempt->exception_class,
                    'message' => $message['value'] ?? '',
                    'messageTruncated' => $message['isTruncated'] ?? false,
                ],
                'inspectorHref' => $this->nodeHref($selected->run_id, NodeIds::attempt(
                    $attempt->run_id,
                    (int) $attempt->attempt_number,
                )),
            ];
        })->all();
        $children = $snapshot->runs
            ->where('parent_run_id', $selected->run_id)
            ->map(fn (object $run): array => [
                'id' => $run->run_id,
                'parentRunId' => $run->parent_run_id,
                'name' => $run->job_name,
                'status' => $run->status,
                'runHref' => $this->runHref($run->run_id),
                'inspectorHref' => $this->nodeHref($selected->run_id, NodeIds::run($run->run_id)),
            ])->values()->all();

        return [
            'run' => [
                'id' => $selected->run_id,
                'jobId' => ObservedIds::job($selected->job_name),
                'name' => $selected->job_name,
                'status' => $selected->status,
                'connection' => $selected->connection,
                'queue' => $selected->queue,
                'queueTarget' => [
                    'connection' => $selected->connection,
                    'queue' => $selected->queue,
                ],
                'driverId' => $selected->driver_id,
                'queueTimeSource' => $selected->queue_time_source,
                'attemptCount' => $attempts->count(),
                'triggeredAt' => Nanoseconds::toRfc3339((int) $selected->triggered_at),
                'queuedAt' => $selected->connection === 'sync' ? null : Nanoseconds::toRfc3339(
                    $selected->queued_at !== null
                        ? (int) $selected->queued_at
                        : ($firstAttempt !== null && $queueTime !== null
                            ? (int) $firstAttempt->started_at - (int) $queueTime
                            : null),
                ),
                'startedAt' => Nanoseconds::toRfc3339($selected->started_at === null ? null : (int) $selected->started_at),
                'finishedAt' => Nanoseconds::toRfc3339($selected->finished_at === null ? null : (int) $selected->finished_at),
                'queueDurationUs' => $queueTime === null ? null : intdiv((int) $queueTime, 1000),
                'durationUs' => $terminal && $selected->started_at !== null && $selected->finished_at !== null
                    ? intdiv((int) $selected->finished_at - (int) $selected->started_at, 1000)
                    : null,
                'traceId' => $snapshot->trace->trace_id,
                'rootRunId' => $snapshot->trace->root_run_id,
                'parentRunId' => $selected->parent_run_id,
            ],
            'attempts' => $attemptViews,
            'relationships' => [
                'parent' => $selected->parent_run_id === null ? null : [
                    'id' => $selected->parent_run_id,
                    'runHref' => $this->runHref($selected->parent_run_id),
                ],
                'children' => $children,
            ],
            'trace' => [
                'revision' => (int) $snapshot->trace->revision,
                'rootStatus' => $selected->status === 'failed'
                    ? 'failed'
                    : ($terminal ? 'completed' : 'executing'),
                'rootStartedAt' => Nanoseconds::toRfc3339((int) $selected->triggered_at),
                'durationUs' => $terminal && $selected->finished_at !== null
                    ? intdiv((int) $selected->finished_at - (int) $selected->triggered_at, 1000)
                    : null,
                'activeDurationUs' => ! $terminal
                    ? intdiv($observedAt - (int) $selected->triggered_at, 1000)
                    : null,
                'queuedDurationUs' => $queueTime === null ? null : intdiv((int) $queueTime, 1000),
                'nodes' => $ordered,
                'nodeCount' => $nodeCount,
                'isTruncated' => $nodeCount > max(1, $limit),
                'polling' => $nodeCount <= max(1, $pollLimit)
                    && ($pollUntil === null || $observedAt < $pollUntil),
                'pollIntervalMs' => 3_000,
                'pollUntil' => Nanoseconds::toRfc3339($pollUntil),
            ],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function nodes(TraceSnapshot $snapshot, int $observedAt): array
    {
        $nodes = [];
        $selected = $snapshot->selectedRun;
        $consumerSpans = $snapshot->spans
            ->where('role', 'consumer')
            ->keyBy('span_id');
        $consumerAttempts = $snapshot->spans
            ->where('role', 'consumer')
            ->keyBy(fn (object $span): string => $span->run_id.':'.$span->attempt_number);
        $producerSpans = $snapshot->spans
            ->where('role', 'producer')
            ->keyBy('run_id');

        foreach ($snapshot->runs as $run) {
            $id = NodeIds::run($run->run_id);
            $parentId = null;

            if ($run->run_id !== $selected->run_id && $run->parent_run_id !== null) {
                $producer = $producerSpans->get($run->run_id);
                $parentConsumer = $producer === null ? null : $consumerSpans->get($producer->parent_span_id);
                $parentId = $parentConsumer !== null && $parentConsumer->attempt_number !== null
                    ? NodeIds::attempt($parentConsumer->run_id, (int) $parentConsumer->attempt_number)
                    : NodeIds::run($run->parent_run_id);
            }

            $terminal = in_array($run->status, ['completed', 'failed'], true);
            $nodes[$id] = $this->node(
                $id,
                $parentId,
                $run->run_id,
                'run',
                $this->jobLabel($run->job_name),
                $run->status,
                (int) ($run->started_at ?? $run->triggered_at),
                $terminal && $run->finished_at !== null ? (int) $run->finished_at : null,
                (int) $selected->triggered_at,
                $run->status === 'failed',
                $this->runTimeline($run, (int) $selected->triggered_at),
            );
        }

        foreach ($snapshot->attempts as $attempt) {
            $id = NodeIds::attempt($attempt->run_id, (int) $attempt->attempt_number);
            $nodes[$id] = $this->node(
                $id,
                NodeIds::run($attempt->run_id),
                $attempt->run_id,
                'attempt',
                'Attempt '.$attempt->attempt_number,
                $attempt->status,
                (int) $attempt->started_at,
                $attempt->finished_at === null ? null : (int) $attempt->finished_at,
                (int) $selected->triggered_at,
                $attempt->status === 'failed',
                $this->attemptTimeline(
                    $attempt,
                    (int) $selected->triggered_at,
                    $consumerAttempts->get($attempt->run_id.':'.$attempt->attempt_number),
                ),
            );
        }

        foreach ($snapshot->spans->where('role', 'consumer') as $consumer) {
            if ($consumer->attempt_number === null) {
                continue;
            }

            foreach ($this->json($consumer->events) as $index => $event) {
                if (($event['name'] ?? null) !== 'log') {
                    continue;
                }

                $attributes = is_array($event['attributes'] ?? null) ? $event['attributes'] : [];
                $level = is_string($attributes['log.level'] ?? null) ? strtolower($attributes['log.level']) : 'warning';
                $message = is_string($attributes['log.message'] ?? null) ? $attributes['log.message'] : 'Log breadcrumb';
                $startedAt = isset($event['timestamp']) ? (int) $event['timestamp'] : (int) $consumer->started_at;
                $id = NodeIds::breadcrumb($consumer->span_id, (int) $index);
                $nodes[$id] = [
                    ...$this->node(
                        $id,
                        NodeIds::attempt($consumer->run_id, (int) $consumer->attempt_number),
                        $consumer->run_id,
                        'breadcrumb',
                        $this->truncate(strtoupper($level).' · '.$message, 512),
                        'completed',
                        $startedAt,
                        $startedAt,
                        (int) $selected->triggered_at,
                        false,
                        [],
                    ),
                    'logLevel' => $level,
                ];
            }
        }

        $visibleSpanIds = $snapshot->spans
            ->whereNotIn('role', ['producer', 'consumer'])
            ->pluck('span_id')
            ->all();

        foreach ($snapshot->spans->whereNotIn('role', ['producer', 'consumer']) as $span) {
            if ($span->attempt_number === null) {
                continue;
            }

            $attributes = $this->json($span->attributes);
            $kind = match ($span->role) {
                'sql' => 'query',
                'http' => 'request',
                default => $span->role ?: 'span',
            };
            $label = match ($span->role) {
                'sql' => is_string($attributes['db.query.text'] ?? null) ? $attributes['db.query.text'] : $span->name,
                'http' => (is_string($attributes['http.request.method'] ?? null) ? $attributes['http.request.method'] : 'HTTP').' '.(is_string($attributes['url.full'] ?? null) ? $attributes['url.full'] : $span->name),
                default => $span->name,
            };
            $id = NodeIds::span($span->span_id);
            $nodes[$id] = $this->node(
                $id,
                in_array($span->parent_span_id, $visibleSpanIds, true)
                    ? NodeIds::span($span->parent_span_id)
                    : NodeIds::attempt($span->run_id, (int) $span->attempt_number),
                $span->run_id,
                $kind,
                $this->truncate($label, 512),
                strtolower($span->status_code) === 'error' ? 'failed' : 'completed',
                (int) $span->started_at,
                (int) $span->ended_at,
                (int) $selected->triggered_at,
                strtolower($span->status_code) === 'error',
                $this->spanTimeline($span, (int) $selected->triggered_at),
            );
        }

        return $nodes;
    }

    /** @param list<array{name: string, offsetUs: int, kind: string}> $timeline */
    private function node(
        string $id,
        ?string $parentId,
        string $runId,
        string $kind,
        string $label,
        string $status,
        int $startedAt,
        ?int $endedAt,
        int $origin,
        bool $isError,
        array $timeline,
    ): array {
        return [
            'id' => $id,
            'parentId' => $parentId,
            'runId' => $runId,
            'kind' => $kind,
            'label' => $label,
            'status' => $status,
            'offsetUs' => intdiv($startedAt - $origin, 1000),
            'durationUs' => $endedAt === null ? null : intdiv($endedAt - $startedAt, 1000),
            'isError' => $isError,
            'isPartial' => false,
            'hasErrorDescendant' => false,
            'timelineEvents' => $timeline,
            '_startedAt' => $startedAt,
        ];
    }

    /** @param array<string, array<string, mixed>> $nodes @param array<string, list<string>> $children */
    private function markErrors(string $id, array &$nodes, array $children): bool
    {
        if (! isset($nodes[$id])) {
            return false;
        }

        $descendantError = false;

        foreach ($children[$id] ?? [] as $child) {
            $descendantError = $this->markErrors($child, $nodes, $children) || $descendantError;
        }

        $nodes[$id]['hasErrorDescendant'] = $descendantError;
        $nodes[$id]['isPartial'] = ! $nodes[$id]['isError'] && $descendantError;

        return $nodes[$id]['isError'] || $descendantError;
    }

    /** @param array<string, array<string, mixed>> $nodes @param array<string, list<string>> $children @param list<array<string, mixed>> $ordered */
    private function flatten(string $id, int $level, array $nodes, array $children, array &$ordered): void
    {
        if (! isset($nodes[$id])) {
            return;
        }

        $node = $nodes[$id];
        $node['level'] = $level;
        $node['children'] = $children[$id] ?? [];
        $node['hasChildren'] = $node['children'] !== [];
        $ordered[] = $node;

        foreach ($children[$id] ?? [] as $child) {
            $this->flatten($child, $level + 1, $nodes, $children, $ordered);
        }
    }

    /** @return list<array{name: string, offsetUs: int, kind: string}> */
    private function runTimeline(object $run, int $origin): array
    {
        $events = [['name' => 'Triggered', 'offsetUs' => intdiv((int) $run->triggered_at - $origin, 1000), 'kind' => 'event']];

        foreach ([['Dequeued', $run->queued_at], ['Started', $run->started_at], ['Finished', $run->finished_at]] as [$name, $at]) {
            if ($at !== null) {
                $events[] = ['name' => $name, 'offsetUs' => intdiv((int) $at - $origin, 1000), 'kind' => 'event'];
            }
        }

        return $events;
    }

    /** @return list<array{name: string, offsetUs: int, kind: string}> */
    private function attemptTimeline(object $attempt, int $origin, ?object $consumer): array
    {
        $events = [['name' => 'Started', 'offsetUs' => intdiv((int) $attempt->started_at - $origin, 1000), 'kind' => 'event']];

        if ($attempt->finished_at !== null) {
            $events[] = [
                'name' => match ($attempt->status) {
                    'completed' => 'Completed',
                    'released' => 'Released',
                    default => 'Failed',
                },
                'offsetUs' => intdiv((int) $attempt->finished_at - $origin, 1000),
                'kind' => 'event',
            ];
        }

        if ($consumer !== null) {
            foreach ($this->json($consumer->events) as $event) {
                $name = (string) ($event['name'] ?? 'Event');

                if (in_array($name, ['attempt.started', 'attempt.finished'], true)) {
                    continue;
                }

                if ($name === 'log') {
                    continue;
                }

                $events[] = [
                    'name' => $this->truncate($name, 512),
                    'offsetUs' => intdiv((int) ($event['timestamp'] ?? $consumer->started_at) - $origin, 1000),
                    'kind' => 'event',
                ];
            }
        }

        usort($events, fn (array $left, array $right): int => $left['offsetUs'] <=> $right['offsetUs']);

        return $events;
    }

    /** @return list<array{name: string, offsetUs: int, kind: string}> */
    private function spanTimeline(object $span, int $origin): array
    {
        return collect($this->json($span->events))->map(fn (array $event): array => [
            'name' => $this->truncate((string) ($event['name'] ?? 'Event'), 512),
            'offsetUs' => intdiv((int) ($event['timestamp'] ?? $span->started_at) - $origin, 1000),
            'kind' => 'event',
        ])->all();
    }

    /** @return array<string, mixed> */
    private function json(?string $value): array
    {
        if ($value === null) {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function jobLabel(string $name): string
    {
        $parts = explode('\\', $name);

        return $this->truncate(end($parts) ?: $name, 512);
    }

    private function truncate(string $value, int $bytes): string
    {
        return Utf8::truncate($value, $bytes);
    }

    private function runHref(string $runId): string
    {
        return '/'.trim((string) config('skyline.path', 'skyline'), '/').'/api/runs/'.rawurlencode($runId);
    }

    private function nodeHref(string $runId, string $nodeId): string
    {
        return $this->runHref($runId).'/nodes/'.rawurlencode($nodeId);
    }
}
