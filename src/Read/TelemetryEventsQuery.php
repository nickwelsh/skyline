<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Connection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use NickWelsh\Skyline\Persistence\SkylineConnection;

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
    ) {}

    /** @return array<string, mixed> */
    public function page(Request $request): array
    {
        $observedAt = Nanoseconds::now();
        $filters = TelemetryEventsFilters::fromRequest($request, $observedAt);
        $all = $this->events()->sort($this->compare(...))->values();
        $events = $filters->apply($all);
        $page = $this->eventPage($request, $events, $filters);

        return [
            ...$this->metadata->at($observedAt),
            'telemetryEvents' => $page['events']->map($this->withoutInternal(...))->all(),
            'pagination' => $page['pagination'],
            'filters' => $filters->toArray(),
            'options' => [
                'levels' => TelemetryEventsFilters::levelOptions(),
                'jobTypes' => $all->pluck('jobType')->unique()->sort()->values()->all(),
                'timeRanges' => JobsFilters::options(),
            ],
            'capture' => $this->capture(),
            'hasAnyTelemetryEvents' => $all->isNotEmpty(),
        ];
    }

    /** @return array<string, mixed> */
    public function detail(string $id): array
    {
        $event = $this->events()->firstWhere('id', $id);
        if (! is_array($event)) {
            throw new RecordNotFound('The Telemetry event was not found.');
        }

        return [
            ...$this->metadata->at(Nanoseconds::now()),
            'telemetryEvent' => $this->detailEvent($event),
            'capture' => $this->capture(),
        ];
    }

    /** @return Collection<int, array<string, mixed>> */
    private function events(): Collection
    {
        return $this->connection()->table('skyline_spans')
            ->join('skyline_runs', 'skyline_runs.run_id', '=', 'skyline_spans.run_id')
            ->whereNotNull('skyline_runs.confirmed_at')
            ->select(['skyline_spans.*', 'skyline_runs.job_name'])
            ->get()
            ->flatMap(function (object $span): array {
                if ($span->role === 'consumer') {
                    return collect($this->json($span->events))->map(function (mixed $event, int $index) use ($span): ?array {
                        if (! is_array($event) || ($event['name'] ?? null) !== 'log') {
                            return null;
                        }

                        return $this->log($span, $event, $index);
                    })->filter()->values()->all();
                }

                return in_array($span->role, ['producer'], true) ? [] : [$this->operation($span)];
            });
    }

    /** @param array<string, mixed> $event @return array<string, mixed> */
    private function log(object $span, array $event, int $index): array
    {
        $attributes = is_array($event['attributes'] ?? null) ? $event['attributes'] : [];
        $level = $this->level($attributes['log.level'] ?? null);
        $context = $this->json(is_string($attributes['log.context'] ?? null) ? $attributes['log.context'] : null);

        return [
            ...$this->shared($span, 'log', $index, (int) ($event['timestamp'] ?? $span->started_at)),
            'level' => $level,
            'message' => is_string($attributes['log.message'] ?? null) ? $attributes['log.message'] : '',
            'context' => $context,
        ];
    }

    /** @return array<string, mixed> */
    private function operation(object $span): array
    {
        $failed = strtolower((string) $span->status_code) === 'error';

        return [
            ...$this->shared($span, 'operation', 0, (int) $span->started_at),
            'level' => $failed ? 'ERROR' : 'TRACE',
            'name' => $span->name,
            'role' => $span->role,
            'kind' => (int) $span->kind,
            'status' => $failed ? 'failed' : 'completed',
            'durationUs' => intdiv((int) $span->ended_at - (int) $span->started_at, 1_000),
            'operationHref' => $this->basePath().'/runs/'.rawurlencode($span->run_id).'?node='.rawurlencode(NodeIds::span($span->span_id)),
        ];
    }

    /** @return array<string, mixed> */
    private function shared(object $span, string $variant, int $index, int $timestamp): array
    {
        $id = ObservedIds::telemetryEvent($span->trace_id, $span->span_id, $variant, $index);

        return [
            'id' => $id,
            'href' => $this->basePath().'/logs?event='.rawurlencode($id),
            'variant' => $variant,
            'runId' => $span->run_id,
            'runHref' => $this->basePath().'/runs/'.rawurlencode($span->run_id),
            'attemptNumber' => $span->attempt_number === null ? null : (int) $span->attempt_number,
            'attemptHref' => $span->attempt_number === null ? null : $this->basePath().'/runs/'.rawurlencode($span->run_id).'?node='.rawurlencode(NodeIds::attempt($span->run_id, (int) $span->attempt_number)),
            'jobType' => $span->job_name,
            'jobHref' => $this->basePath().'/jobs/'.ObservedIds::job($span->job_name),
            'timestamp' => Nanoseconds::toRfc3339($timestamp),
            'traceId' => $span->trace_id,
            'spanId' => $span->span_id,
            'parentSpanId' => $span->parent_span_id,
            '_timestamp' => $timestamp,
            '_span' => $span,
            '_eventIndex' => $index,
        ];
    }

    /** @param array<string, mixed> $event @return array<string, mixed> */
    private function withoutInternal(array $event): array
    {
        return array_filter($event, fn (string|int $key): bool => ! is_string($key) || ! str_starts_with($key, '_'), ARRAY_FILTER_USE_KEY);
    }

    /** @param Collection<int, array<string, mixed>> $events @return array{events: Collection<int, array<string, mixed>>, pagination: array{previous: ?string, next: ?string}} */
    private function eventPage(Request $request, Collection $events, TelemetryEventsFilters $filters): array
    {
        $all = $events;
        $direction = 'next';
        $cursor = $request->query('cursor');

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
            $events = $events->filter(function (array $event) use ($decoded, $direction): bool {
                $comparison = $this->compareToCursor($event, $decoded);

                return $direction === 'previous' ? $comparison < 0 : $comparison > 0;
            })->values();
            if ($direction === 'previous') {
                $events = $events->take(-self::PAGE_SIZE)->values();
            }
        }

        $page = $direction === 'previous' ? $events : $events->take(self::PAGE_SIZE)->values();
        $first = $page->first();
        $last = $page->last();

        return [
            'events' => $page,
            'pagination' => [
                'previous' => $first !== null && $all->contains(fn (array $event): bool => $this->compare($event, $first) < 0)
                    ? $this->cursor('previous', $first, $filters) : null,
                'next' => $last !== null && $all->contains(fn (array $event): bool => $this->compare($event, $last) > 0)
                    ? $this->cursor('next', $last, $filters) : null,
            ],
        ];
    }

    /** @param array<string, mixed> $left @param array<string, mixed> $right */
    private function compare(array $left, array $right): int
    {
        return [$right['_timestamp'], $right['id']] <=> [$left['_timestamp'], $left['id']];
    }

    /** @param array<string, mixed> $event @param array<string, mixed> $cursor */
    private function compareToCursor(array $event, array $cursor): int
    {
        return [$cursor['timestamp'], $cursor['id']] <=> [$event['_timestamp'], $event['id']];
    }

    /** @param array<string, mixed> $event */
    private function cursor(string $direction, array $event, TelemetryEventsFilters $filters): string
    {
        return $this->cursors->encode('telemetry-events', [
            'direction' => $direction,
            'timestamp' => $event['_timestamp'],
            'id' => $event['id'],
            'filters' => $filters->toArray(),
        ]);
    }

    /** @param array<string, mixed> $event @return array<string, mixed> */
    private function detailEvent(array $event): array
    {
        $summary = $this->withoutInternal($event);
        $relationships = [
            'traceId' => $summary['traceId'],
            'spanId' => $summary['spanId'],
            'parentSpanId' => $summary['parentSpanId'],
        ];

        if ($summary['variant'] === 'log') {
            $span = $event['_span'];
            $attributes = collect($this->json($span->events))->get((int) $event['_eventIndex']);
            $attributes = is_array($attributes) && is_array($attributes['attributes'] ?? null) ? $attributes['attributes'] : [];

            return [
                ...$summary,
                'relationships' => $relationships,
                'channel' => is_string($attributes['log.channel'] ?? null) ? $attributes['log.channel'] : null,
                'errorHref' => $this->errorHref($span),
            ];
        }

        $node = $this->nodes->get($summary['runId'], NodeIds::span($summary['spanId']))['node'];
        $metadata = is_array($node['metadata'] ?? null) ? $node['metadata'] : [];
        $value = is_array($metadata['value'] ?? null) ? $metadata['value'] : [];
        $span = $event['_span'];
        $rawEvents = $this->json($span->events);
        $events = collect(is_array($value['events'] ?? null) ? $value['events'] : [])
            ->map(function (array $captured, int $index) use ($rawEvents): array {
                $raw = is_array($rawEvents[$index] ?? null) ? $rawEvents[$index] : [];

                return [
                    ...$captured,
                    'timestamp' => Nanoseconds::toRfc3339(isset($raw['timestamp']) ? (int) $raw['timestamp'] : null),
                ];
            })->all();
        $rawLinks = $this->json($span->links);
        $links = collect(is_array($value['links'] ?? null) ? $value['links'] : [])
            ->map(function (array $captured, int $index) use ($rawLinks): array {
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
            'capture' => [
                'isTruncated' => (bool) ($metadata['isTruncated'] ?? false),
                'truncated' => is_array($metadata['truncated'] ?? null) ? $metadata['truncated'] : [],
            ],
            'errorHref' => $this->errorHref($span),
        ];
    }

    private function errorHref(object $span): ?string
    {
        if ($span->attempt_number === null) {
            return null;
        }

        $attempt = $this->connection()->table('skyline_attempts')
            ->where('run_id', $span->run_id)
            ->where('attempt_number', $span->attempt_number)
            ->whereNotNull('exception_class')
            ->first();
        if ($attempt === null) {
            return null;
        }

        $exception = $this->exceptions->present($attempt, $span->job_name);
        $identity = $this->errorGroups->identify($span->job_name, $exception);

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

    private function level(mixed $level): string
    {
        return match (strtolower(is_string($level) ? $level : 'info')) {
            'trace' => 'TRACE',
            'debug' => 'DEBUG',
            'warning', 'warn', 'notice' => 'WARN',
            'error', 'critical', 'alert', 'emergency' => 'ERROR',
            default => 'INFO',
        };
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

    private function basePath(): string
    {
        return '/'.trim((string) config('skyline.path', 'skyline'), '/');
    }

    private function connection(): Connection
    {
        return $this->database->get();
    }
}
