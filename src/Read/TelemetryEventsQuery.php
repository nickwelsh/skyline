<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use NickWelsh\Skyline\Support\LogEventSanitizer;

final readonly class TelemetryEventsQuery
{
    private const PAGE_SIZE = 25;

    public function __construct(
        private SkylineConnection $database,
        private ApiMetadata $metadata,
        private NodeQuery $nodes,
        private CursorCodec $cursors,
        private ExceptionPresenter $exceptions,
        private ErrorGroupFingerprint $errorGroups,
        private LogEventSanitizer $logs,
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = TelemetryEventsFilters::fromRequest($request, $observedAt);
        $events = $filters->applyQuery($this->query());
        $page = $this->eventPage($request, $events, $filters);
        $all = $this->query();

        return [
            ...$this->metadata->at($observedAt),
            'telemetryEvents' => $page['events']->map($this->summary(...))->all(),
            'pagination' => $page['pagination'],
            'filters' => $filters->toArray(),
            'options' => [
                'levels' => TelemetryEventsFilters::levelOptions(),
                'jobTypes' => $this->jobTypes(),
                'timeRanges' => JobsFilters::options(),
            ],
            'capture' => $this->capture(),
            'hasAnyTelemetryEvents' => (clone $all)->exists(),
        ];
    }

    /** @return array<string, mixed> */
    public function detail(string $id): array
    {
        $event = $this->query()->where('skyline_telemetry_events.event_id', $id)->first();
        if ($event === null) {
            throw new RecordNotFound('The Telemetry event was not found.');
        }
        $span = $this->connection()->table('skyline_spans')
            ->where('trace_id', $event->trace_id)
            ->where('span_id', $event->span_id)
            ->first();
        if ($span === null) {
            throw new RecordNotFound('The Telemetry event was not found.');
        }

        return [
            ...$this->metadata->at(Nanoseconds::now()),
            'telemetryEvent' => $this->detailEvent($event, $span),
            'capture' => $this->capture(),
        ];
    }

    private function query(): Builder
    {
        return $this->connection()->table('skyline_telemetry_events')
            ->join('skyline_runs', 'skyline_runs.run_id', '=', 'skyline_telemetry_events.run_id')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->select([
                'skyline_telemetry_events.*',
                'skyline_runs.job_name',
            ]);
    }

    /** @return list<string> */
    private function jobTypes(): array
    {
        return $this->connection()->table('skyline_telemetry_events')
            ->join('skyline_runs', 'skyline_runs.run_id', '=', 'skyline_telemetry_events.run_id')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->select('skyline_runs.job_name')
            ->distinct()
            ->orderBy('skyline_runs.job_name')
            ->pluck('skyline_runs.job_name')
            ->all();
    }

    /** @return array<string, mixed> */
    private function summary(object $event): array
    {
        $id = (string) $event->event_id;
        $shared = [
            'id' => $id,
            'href' => $this->basePath().'/logs?event='.rawurlencode($id),
            'variant' => $event->variant,
            'runId' => $event->run_id,
            'runHref' => $this->basePath().'/runs/'.rawurlencode($event->run_id),
            'attemptNumber' => $event->attempt_number === null ? null : (int) $event->attempt_number,
            'attemptHref' => $event->attempt_number === null ? null : $this->basePath().'/runs/'.rawurlencode($event->run_id).'?node='.rawurlencode(NodeIds::attempt($event->run_id, (int) $event->attempt_number)),
            'jobType' => $event->job_name,
            'jobHref' => $this->basePath().'/jobs/'.ObservedIds::job($event->job_name),
            'timestamp' => Nanoseconds::toRfc3339((int) $event->occurred_at),
            'traceId' => $event->trace_id,
            'spanId' => $event->span_id,
            'parentSpanId' => $event->parent_span_id,
            'level' => $event->level,
        ];

        if ($event->variant === 'log') {
            return [...$shared, 'message' => (string) ($event->message ?? ''), 'context' => $this->json($event->context)];
        }

        return [
            ...$shared,
            'name' => $event->name,
            'role' => $event->role,
            'kind' => (int) $event->kind,
            'status' => $event->status,
            'durationUs' => (int) $event->duration_us,
            'operationHref' => $this->basePath().'/runs/'.rawurlencode($event->run_id).'?node='.rawurlencode(NodeIds::span($event->span_id)),
        ];
    }

    /** @return array{events: Collection<int, object>, pagination: array{previous: ?string, next: ?string}} */
    private function eventPage(Request $request, Builder $events, TelemetryEventsFilters $filters): array
    {
        $cursor = $request->query('cursor');
        $direction = 'next';
        $decoded = null;
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'telemetry-events');
            $direction = $decoded['direction'] ?? null;
            if (! in_array($direction, ['next', 'previous'], true)
                || ! is_int($decoded['timestamp'] ?? null)
                || ! is_string($decoded['id'] ?? null)
                || ($decoded['filters'] ?? null) !== $filters->toArray()
            ) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $this->beyond($events, $decoded['timestamp'], $decoded['id'], $direction);
        }

        $ascending = $direction === 'previous';
        $rows = $events
            ->orderBy('skyline_telemetry_events.occurred_at', $ascending ? 'asc' : 'desc')
            ->orderBy('skyline_telemetry_events.event_id', $ascending ? 'asc' : 'desc')
            ->limit(self::PAGE_SIZE + 1)
            ->get();
        if ($rows->count() > self::PAGE_SIZE) {
            $rows = $rows->take(self::PAGE_SIZE);
        }
        if ($ascending) {
            $rows = $rows->reverse()->values();
        }
        $first = $rows->first();
        $last = $rows->last();

        return [
            'events' => $rows,
            'pagination' => [
                'previous' => $first !== null && $this->existsBeyond($filters, $first, 'previous') ? $this->cursor('previous', $first, $filters) : null,
                'next' => $last !== null && $this->existsBeyond($filters, $last, 'next') ? $this->cursor('next', $last, $filters) : null,
            ],
        ];
    }

    private function existsBeyond(TelemetryEventsFilters $filters, object $event, string $direction): bool
    {
        $query = $filters->applyQuery($this->query());
        $this->beyond($query, (int) $event->occurred_at, (string) $event->event_id, $direction);

        return $query->exists();
    }

    private function beyond(Builder $query, int $timestamp, string $id, string $direction): void
    {
        $operator = $direction === 'previous' ? '>' : '<';
        $query->where(function (Builder $query) use ($timestamp, $id, $operator): void {
            $query->where('skyline_telemetry_events.occurred_at', $operator, $timestamp)
                ->orWhere(function (Builder $query) use ($timestamp, $id, $operator): void {
                    $query->where('skyline_telemetry_events.occurred_at', $timestamp)
                        ->where('skyline_telemetry_events.event_id', $operator, $id);
                });
        });
    }

    private function cursor(string $direction, object $event, TelemetryEventsFilters $filters): string
    {
        return $this->cursors->encode('telemetry-events', [
            'direction' => $direction,
            'timestamp' => (int) $event->occurred_at,
            'id' => (string) $event->event_id,
            'filters' => $filters->toArray(),
        ]);
    }

    /** @return array<string, mixed> */
    private function detailEvent(object $event, object $span): array
    {
        $summary = $this->summary($event);
        $relationships = ['traceId' => $summary['traceId'], 'spanId' => $summary['spanId'], 'parentSpanId' => $summary['parentSpanId']];

        if ($summary['variant'] === 'log') {
            $raw = collect($this->json($span->events))->get((int) $event->event_index);
            $attributes = is_array($raw) && is_array($raw['attributes'] ?? null) ? $raw['attributes'] : [];
            $presented = $this->logs->present($attributes);

            return [
                ...$summary,
                'level' => $presented['level'],
                'message' => $presented['message'],
                'context' => $presented['context'],
                'relationships' => $relationships,
                'channel' => $presented['channel'],
                'attributes' => $presented['attributes'],
                'capture' => $presented['capture'],
                'errorHref' => $this->errorHref($span, $event->job_name),
            ];
        }

        $node = $this->nodes->get($summary['runId'], NodeIds::span($summary['spanId']))['node'];
        $metadata = is_array($node['metadata'] ?? null) ? $node['metadata'] : [];
        $value = is_array($metadata['value'] ?? null) ? $metadata['value'] : [];
        $rawEvents = $this->json($span->events);
        $events = collect(is_array($value['events'] ?? null) ? $value['events'] : [])->map(function (array $captured, int $index) use ($rawEvents): array {
            $raw = is_array($rawEvents[$index] ?? null) ? $rawEvents[$index] : [];

            return [...$captured, 'timestamp' => Nanoseconds::toRfc3339(isset($raw['timestamp']) ? (int) $raw['timestamp'] : null)];
        })->all();
        $rawLinks = $this->json($span->links);
        $links = collect(is_array($value['links'] ?? null) ? $value['links'] : [])->map(function (array $captured, int $index) use ($rawLinks): array {
            $raw = is_array($rawLinks[$index] ?? null) ? $rawLinks[$index] : [];

            return [
                ...$captured,
                'traceId' => is_string($raw['trace_id'] ?? null) ? $raw['trace_id'] : null,
                'spanId' => is_string($raw['span_id'] ?? null) ? $raw['span_id'] : null,
                'traceFlags' => is_int($raw['trace_flags'] ?? null) ? $raw['trace_flags'] : null,
                'remote' => is_bool($raw['remote'] ?? null) ? $raw['remote'] : null,
            ];
        })->all();

        return [
            ...$summary,
            'relationships' => $relationships,
            'attributes' => is_array($value['attributes'] ?? null) ? $value['attributes'] : [],
            'events' => $events,
            'links' => $links,
            'resource' => is_array($value['resource'] ?? null) ? $value['resource'] : [],
            'instrumentation' => is_array($value['instrumentation'] ?? null) ? $value['instrumentation'] : [],
            'capture' => ['isTruncated' => (bool) ($metadata['isTruncated'] ?? false), 'truncated' => is_array($metadata['truncated'] ?? null) ? $metadata['truncated'] : []],
            'errorHref' => $this->errorHref($span, $event->job_name),
        ];
    }

    private function errorHref(object $span, string $jobType): ?string
    {
        if ($span->attempt_number === null) {
            return null;
        }
        $attempt = $this->connection()->table('skyline_attempts')->where('run_id', $span->run_id)->where('attempt_number', $span->attempt_number)->whereNotNull('exception_class')->first();
        if ($attempt === null) {
            return null;
        }
        $identity = $this->errorGroups->identify($jobType, $this->exceptions->present($attempt, $jobType));

        return $this->basePath().'/errors/'.$identity['id'];
    }

    /** @return array{enabled: bool, supportedLevels: list<string>, perAttemptLimit: int} */
    private function capture(): array
    {
        return [
            'enabled' => (bool) config('skyline.logging.enabled', false),
            'supportedLevels' => array_values(array_filter((array) config('skyline.logging.levels', []), 'is_string')),
            'perAttemptLimit' => max(0, (int) config('skyline.logging.max_breadcrumbs', 100)),
        ];
    }

    /** @return array<int|string, mixed> */
    private function json(?string $value): array
    {
        $decoded = $value === null ? [] : json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function basePath(): string
    {
        return '/'.trim((string) config('skyline.path', 'skyline'), '/');
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
