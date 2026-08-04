<?php

namespace NickWelsh\Skyline\Persistence;

use OpenTelemetry\SDK\Trace\SpanDataInterface;

final readonly class SpanRepository
{
    public function __construct(
        private SkylineConnection $database,
        private TraceRepository $traces,
    ) {}

    public function insert(SpanDataInterface $span): bool
    {
        return $this->insertMany([$span]) > 0;
    }

    /** @param list<SpanDataInterface> $spans */
    public function insertMany(array $spans): int
    {
        if ($spans === []) {
            return 0;
        }

        $rows = [];

        foreach ($spans as $span) {
            $attributes = $span->getAttributes()->toArray();
            $runId = $attributes['skyline.run_id'] ?? null;

            if (! is_string($runId) || $runId === '') {
                continue;
            }

            $parentRunId = $attributes['skyline.parent_run_id'] ?? null;
            $parentRunId = is_string($parentRunId) && $parentRunId !== '' ? $parentRunId : null;
            $this->traces->ensureRun(
                $span->getTraceId(),
                $runId,
                $parentRunId,
                $span->getStartEpochNanos(),
                is_string($attributes['laravel.job.name'] ?? null)
                    ? $attributes['laravel.job.name']
                    : 'unknown',
            );

            if (($attributes['skyline.role'] ?? null) === 'consumer') {
                $this->traces->ensureAttemptFromSpan($span);
            }
            $scope = $span->getInstrumentationScope();
            $rows[] = [
                'trace_id' => $span->getTraceId(),
                'run_id' => $runId,
                'attempt_number' => is_numeric($attributes['skyline.attempt'] ?? null)
                    ? (int) $attributes['skyline.attempt']
                    : null,
                'span_id' => $span->getSpanId(),
                'parent_span_id' => $span->getParentSpanId() ?: null,
                'name' => $this->truncate($span->getName(), 512),
                'role' => is_string($attributes['skyline.role'] ?? null)
                    ? $this->truncate($attributes['skyline.role'], 32)
                    : null,
                'kind' => $span->getKind(),
                'status_code' => $span->getStatus()->getCode(),
                'status_description' => $span->getStatus()->getDescription() ?: null,
                'started_at' => $span->getStartEpochNanos(),
                'ended_at' => $span->getEndEpochNanos(),
                'attributes' => $this->json($attributes),
                'events' => $this->json($this->events($span)),
                'links' => $this->json($this->links($span)),
                'resource_attributes' => $this->json($span->getResource()->getAttributes()->toArray()),
                'scope_name' => $scope->getName() ?: null,
                'scope_version' => $scope->getVersion() ?: null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($rows === []) {
            return 0;
        }

        $inserted = $this->database->get()->table('skyline_spans')->insertOrIgnore($rows);

        foreach (collect($rows)->unique('trace_id') as $row) {
            if ($inserted > 0) {
                $this->traces->touch($row['trace_id'], (int) $row['ended_at']);
            }
        }

        return $inserted;
    }

    /** @return list<array{name: string, timestamp: int, attributes: array<string, mixed>}> */
    private function events(SpanDataInterface $span): array
    {
        return array_map(fn ($event): array => [
            'name' => $event->getName(),
            'timestamp' => $event->getEpochNanos(),
            'attributes' => $event->getAttributes()->toArray(),
        ], $span->getEvents());
    }

    /** @return list<array{trace_id: string, span_id: string, trace_flags: int, remote: bool, attributes: array<string, mixed>}> */
    private function links(SpanDataInterface $span): array
    {
        return array_map(function ($link): array {
            $context = $link->getSpanContext();

            return [
                'trace_id' => $context->getTraceId(),
                'span_id' => $context->getSpanId(),
                'trace_flags' => $context->getTraceFlags(),
                'remote' => $context->isRemote(),
                'attributes' => $link->getAttributes()->toArray(),
            ];
        }, $span->getLinks());
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    private function truncate(string $value, int $length): string
    {
        return substr($value, 0, $length);
    }
}
