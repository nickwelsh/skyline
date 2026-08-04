<?php

namespace NickWelsh\Skyline\Persistence;

use NickWelsh\Skyline\Support\Utf8;
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
    public function insertMany(
        array $spans,
        bool $ensureRelations = true,
        bool $touchTraces = true,
    ): int {
        $prepared = $this->prepareMany($spans);

        if ($ensureRelations) {
            foreach ($prepared as $entry) {
                $span = $entry['span'];
                $attributes = $entry['attributes'];
                $parentRunId = $attributes['skyline.parent_run_id'] ?? null;
                $parentRunId = is_string($parentRunId) && $parentRunId !== '' ? $parentRunId : null;
                $this->traces->ensureRun(
                    $entry['row']['trace_id'],
                    $entry['row']['run_id'],
                    $parentRunId,
                    $entry['row']['started_at'],
                    is_string($attributes['laravel.job.name'] ?? null)
                        ? $attributes['laravel.job.name']
                        : 'unknown',
                );

                if (($attributes['skyline.role'] ?? null) === 'consumer') {
                    $this->traces->ensureAttemptFromSpan($span);
                }
            }
        }

        return $this->insertPrepared($prepared, $touchTraces);
    }

    /**
     * @param  list<SpanDataInterface>  $spans
     * @return list<array{span: SpanDataInterface, attributes: array<string, mixed>, row: array<string, mixed>}>
     */
    public function prepareMany(array $spans): array
    {
        $prepared = [];
        $timestamp = now();

        foreach ($spans as $span) {
            $attributes = $span->getAttributes()->toArray();
            $runId = $attributes['skyline.run_id'] ?? null;

            if (! is_string($runId) || $runId === '') {
                continue;
            }

            $role = is_string($attributes['skyline.role'] ?? null)
                ? $this->truncate($attributes['skyline.role'], 32)
                : null;
            $isSql = $role === 'sql';
            $status = $span->getStatus();
            $prepared[] = [
                'span' => $span,
                'attributes' => $attributes,
                'row' => [
                    'trace_id' => $span->getTraceId(),
                    'run_id' => $runId,
                    'attempt_number' => is_numeric($attributes['skyline.attempt'] ?? null)
                        ? (int) $attributes['skyline.attempt']
                        : null,
                    'span_id' => $span->getSpanId(),
                    'parent_span_id' => $span->getParentSpanId() ?: null,
                    'name' => $this->truncate($span->getName(), 512),
                    'role' => $role,
                    'kind' => $span->getKind(),
                    'status_code' => $status->getCode(),
                    'status_description' => $status->getDescription() ?: null,
                    'started_at' => $span->getStartEpochNanos(),
                    'ended_at' => $span->getEndEpochNanos(),
                    'attributes' => $this->json($attributes),
                    'events' => $isSql ? '[]' : $this->json($this->events($span)),
                    'links' => $isSql ? '[]' : $this->json($this->links($span)),
                    'resource_attributes' => '{}',
                    'scope_name' => 'nickwelsh/skyline',
                    'scope_version' => null,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ],
            ];
        }

        return $prepared;
    }

    /**
     * @param  list<array{span: SpanDataInterface, attributes: array<string, mixed>, row: array<string, mixed>}>  $prepared
     */
    public function insertPrepared(array $prepared, bool $touchTraces = true): int
    {
        if ($prepared === []) {
            return 0;
        }

        $rows = array_column($prepared, 'row');
        $connection = $this->database->get();
        $chunkSize = $connection->getDriverName() === 'sqlite' ? 1_000 : 2_000;
        $inserted = 0;

        foreach (array_chunk($rows, $chunkSize) as $chunk) {
            $inserted += $connection->table('skyline_spans')->insertOrIgnore($chunk);
        }

        if ($touchTraces && $inserted > 0) {
            foreach (collect($rows)->unique('trace_id') as $row) {
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
        return Utf8::truncate($value, $length);
    }
}
