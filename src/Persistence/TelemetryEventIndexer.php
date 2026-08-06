<?php

namespace NickWelsh\Skyline\Persistence;

use NickWelsh\Skyline\Read\ObservedIds;
use NickWelsh\Skyline\Support\LogEventSanitizer;

final readonly class TelemetryEventIndexer
{
    public function __construct(private LogEventSanitizer $logs) {}

    /** @param array<string, mixed> $span @return list<array<string, mixed>> */
    public function rows(array $span): array
    {
        $shared = fn (string $variant, int $index, int $occurredAt): array => [
            'event_id' => ObservedIds::telemetryEvent($span['trace_id'], $span['span_id'], $variant, $index),
            'trace_id' => $span['trace_id'],
            'run_id' => $span['run_id'],
            'attempt_number' => $span['attempt_number'],
            'span_id' => $span['span_id'],
            'parent_span_id' => $span['parent_span_id'],
            'variant' => $variant,
            'event_index' => $index,
            'occurred_at' => $occurredAt,
            'created_at' => $span['created_at'],
            'updated_at' => $span['updated_at'],
        ];
        if ($span['role'] === 'producer') {
            return [];
        }
        if ($span['role'] !== 'consumer') {
            $failed = strtolower((string) $span['status_code']) === 'error';

            return [[
                ...$shared('operation', 0, (int) $span['started_at']),
                'level' => $failed ? 'ERROR' : 'TRACE',
                'name' => $span['name'],
                'role' => $span['role'],
                'kind' => $span['kind'],
                'status' => $failed ? 'failed' : 'completed',
                'duration_us' => intdiv((int) $span['ended_at'] - (int) $span['started_at'], 1_000),
                'message' => null,
                'context' => '{}',
            ]];
        }
        $events = json_decode($span['events'], true);

        return collect(is_array($events) ? $events : [])->map(function (mixed $event, int $index) use ($shared, $span): ?array {
            if (! is_array($event) || ($event['name'] ?? null) !== 'log') {
                return null;
            }
            $attributes = is_array($event['attributes'] ?? null) ? $event['attributes'] : [];
            $presented = $this->logs->present($attributes);

            return [
                ...$shared('log', $index, (int) ($event['timestamp'] ?? $span['started_at'])),
                'level' => $presented['level'],
                'name' => null,
                'role' => null,
                'kind' => null,
                'status' => null,
                'duration_us' => null,
                'message' => $presented['message'],
                'context' => json_encode($presented['context'], JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE),
            ];
        })->filter()->values()->all();
    }
}
