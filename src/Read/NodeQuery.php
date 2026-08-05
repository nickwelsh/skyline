<?php

namespace NickWelsh\Skyline\Read;

use Throwable;

final readonly class NodeQuery
{
    public function __construct(
        private TraceSnapshotQuery $snapshots,
        private TraceViewBuilder $builder,
        private ApiMetadata $metadata,
        private EditorLink $editorLink,
    ) {}

    /** @return array<string, mixed> */
    public function get(string $runId, string $nodeId): array
    {
        $observedAt = Nanoseconds::now();
        $snapshot = $this->snapshots->get($runId);
        $view = $this->builder->build($snapshot, $observedAt, PHP_INT_MAX, PHP_INT_MAX);
        $node = collect($view['trace']['nodes'])->firstWhere('id', $nodeId);

        if ($node === null) {
            throw new RecordNotFound('The node was not found.');
        }

        $details = match ($node['kind']) {
            'run' => $this->run($snapshot, $node['runId']),
            'attempt' => $this->attempt($snapshot, $nodeId),
            'query' => $this->span($snapshot, $nodeId),
            default => throw new RecordNotFound('The node was not found.'),
        };

        return [
            ...$this->metadata->at($observedAt),
            'traceRevision' => (int) $snapshot->trace->revision,
            'node' => [...$node, ...$details],
        ];
    }

    /** @return array<string, mixed> */
    private function run(TraceSnapshot $snapshot, string $runId): array
    {
        $run = $snapshot->runs->firstWhere('run_id', $runId);

        if ($run === null) {
            throw new RecordNotFound('The Run node was not found.');
        }

        $producer = $snapshot->spans->first(fn (object $span): bool => $span->run_id === $runId && $span->role === 'producer');

        return [
            'overview' => [
                'runId' => $run->run_id,
                'traceId' => $run->trace_id,
                'parentRunId' => $run->parent_run_id,
                'jobName' => $run->job_name,
                'connection' => $run->connection,
                'queue' => $run->queue,
                'driverId' => $run->driver_id,
                'queueTimeSource' => $run->queue_time_source,
            ],
            'metadata' => $this->spanMetadata($producer),
        ];
    }

    /** @return array<string, mixed> */
    private function attempt(TraceSnapshot $snapshot, string $nodeId): array
    {
        $attempt = $snapshot->attempts->first(fn (object $attempt): bool => NodeIds::attempt(
            $attempt->run_id,
            (int) $attempt->attempt_number,
        ) === $nodeId);

        if ($attempt === null) {
            throw new RecordNotFound('The Attempt node was not found.');
        }

        $consumer = $snapshot->spans->first(fn (object $span): bool => $span->run_id === $attempt->run_id
            && (int) $span->attempt_number === (int) $attempt->attempt_number
            && $span->role === 'consumer');

        return [
            'overview' => [
                'runId' => $attempt->run_id,
                'attemptNumber' => (int) $attempt->attempt_number,
                'queueDurationUs' => $attempt->queue_time_ns === null ? null : intdiv((int) $attempt->queue_time_ns, 1000),
                'queueTimeSource' => $attempt->queue_time_source,
                'traceId' => $consumer?->trace_id,
                'spanId' => $consumer?->span_id,
                'parentSpanId' => $consumer?->parent_span_id,
            ],
            'exception' => $attempt->exception_class === null ? null : $this->exception($attempt),
            'metadata' => $this->spanMetadata($consumer),
        ];
    }

    /** @return array<string, mixed> */
    private function span(TraceSnapshot $snapshot, string $nodeId): array
    {
        $span = $snapshot->spans->first(fn (object $span): bool => NodeIds::span($span->span_id) === $nodeId
            && $span->role === 'sql');

        if ($span === null) {
            throw new RecordNotFound('The span node was not found.');
        }

        $sanitizer = new PrivacySanitizer;
        $attributes = $this->json($span->attributes);
        $sql = $sanitizer->string(
            is_string($attributes['db.query.text'] ?? null) ? $attributes['db.query.text'] : $span->name,
            max(1, (int) config('skyline.privacy.sql_bytes', 65_536)),
            'sql',
        );

        return [
            'overview' => [
                'runId' => $span->run_id,
                'attemptNumber' => $span->attempt_number === null ? null : (int) $span->attempt_number,
                'traceId' => $span->trace_id,
                'spanId' => $span->span_id,
                'parentSpanId' => $span->parent_span_id,
                'statusDescription' => $span->status_description,
            ],
            'sql' => $sql,
            'source' => $this->source($attributes),
            'bindings' => $this->sqlCapture($attributes, 'skyline.sql.bindings'),
            'result' => $this->sqlCapture($attributes, 'skyline.sql.result'),
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @return array<string, mixed> */
    private function spanMetadata(?object $span): array
    {
        if ($span === null) {
            return ['value' => [], 'isTruncated' => false, 'truncated' => []];
        }

        $sanitizer = new PrivacySanitizer;
        $attributes = $this->json($span->attributes);
        unset(
            $attributes['skyline.sql.bindings'],
            $attributes['skyline.sql.result'],
            $attributes['skyline.sql.source.file'],
            $attributes['skyline.sql.source.line'],
        );
        $events = collect($this->json($span->events))->map(function (array $event) use ($sanitizer): array {
            return [
                'name' => $event['name'] ?? 'Event',
                'timestamp' => Nanoseconds::toRfc3339(isset($event['timestamp']) ? (int) $event['timestamp'] : null),
                'attributes' => $sanitizer->attributes(is_array($event['attributes'] ?? null) ? $event['attributes'] : []),
            ];
        })->all();
        $resource = array_filter(
            $this->json($span->resource_attributes),
            fn (mixed $value, string|int $key): bool => is_string($key) && (
                str_starts_with($key, 'service.')
                || str_starts_with($key, 'telemetry.sdk.')
                || $key === 'deployment.environment.name'
            ),
            ARRAY_FILTER_USE_BOTH,
        );
        $links = collect($this->json($span->links))->map(fn (array $link): array => [
            'traceId' => $link['trace_id'] ?? null,
            'spanId' => $link['span_id'] ?? null,
            'traceFlags' => $link['trace_flags'] ?? null,
            'remote' => $link['remote'] ?? null,
            'attributes' => $sanitizer->attributes(is_array($link['attributes'] ?? null) ? $link['attributes'] : []),
        ])->all();

        return $sanitizer->metadata([
            'attributes' => $sanitizer->attributes($attributes),
            'events' => $events,
            'links' => $links,
            'resource' => $resource,
            'instrumentation' => [
                'name' => $span->scope_name,
                'version' => $span->scope_version,
            ],
        ]);
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed>|null */
    private function sqlCapture(array $attributes, string $key): ?array
    {
        $value = $attributes[$key] ?? null;

        if (! is_string($value)) {
            return null;
        }

        try {
            $decoded = json_decode($value, true, flags: JSON_THROW_ON_ERROR);

            return is_array($decoded) ? $decoded : null;
        } catch (Throwable) {
            return null;
        }
    }

    /** @param array<string, mixed> $attributes @return array{file: string, line: int, href: string|null}|null */
    private function source(array $attributes): ?array
    {
        $file = $attributes['skyline.sql.source.file'] ?? null;
        $line = $attributes['skyline.sql.source.line'] ?? null;

        if (! is_string($file) || $file === '' || (! is_int($line) && ! is_numeric($line))) {
            return null;
        }

        $line = (int) $line;

        return [
            'file' => $this->relativeSourceFile($file),
            'line' => $line,
            'href' => $this->editorLink->href($file, $line),
        ];
    }

    /** @return array<string, mixed> */
    private function exception(object $attempt): array
    {
        $sanitizer = new PrivacySanitizer;
        $message = $sanitizer->string(
            (string) $attempt->exception_message,
            max(1, (int) config('skyline.privacy.exception_message_bytes', 16_384)),
            'exception.message',
        );
        $lines = preg_split('/\R/', (string) $attempt->exception_trace) ?: [];
        $frames = [];

        foreach (array_slice($lines, 0, 100) as $line) {
            if (! preg_match('/^#\d+\s+(.+?)(?:\((\d+)\))?:\s+(.+)$/', $line, $matches)) {
                continue;
            }

            $call = $this->call($matches[3]);
            $frames[] = [
                'file' => $this->relativeFile($matches[1]),
                'line' => isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : null,
                ...$call,
            ];
        }

        return [
            'class' => $attempt->exception_class,
            'message' => $message['value'],
            'messageTruncated' => $message['isTruncated'],
            'messageOriginalBytes' => $message['originalBytes'],
            'code' => $attempt->exception_code,
            'location' => [
                'file' => $this->relativeFile((string) $attempt->exception_file),
                'line' => $attempt->exception_line === null ? null : (int) $attempt->exception_line,
            ],
            'frames' => $frames,
            'framesTruncated' => count($lines) > 100,
        ];
    }

    /** @return array{class: ?string, type: ?string, function: string} */
    private function call(string $call): array
    {
        $call = preg_replace('/\([^)]*\).*$/', '', $call) ?? $call;

        if (preg_match('/^(.+?)(::|->)([^:]+)$/', $call, $matches)) {
            return ['class' => $matches[1], 'type' => $matches[2], 'function' => $matches[3]];
        }

        return ['class' => null, 'type' => null, 'function' => $call];
    }

    private function relativeFile(string $file): string
    {
        $normalized = str_replace('\\', '/', $file);
        $base = rtrim(str_replace('\\', '/', base_path()), '/').'/';

        if (str_starts_with($normalized, $base)) {
            return substr($normalized, strlen($base));
        }

        foreach (['/app/', '/vendor/'] as $marker) {
            if (($position = strpos($normalized, $marker)) !== false) {
                return ltrim(substr($normalized, $position), '/');
            }
        }

        return basename($normalized);
    }

    private function relativeSourceFile(string $file): string
    {
        $normalized = str_replace('\\', '/', $file);
        $package = rtrim(str_replace('\\', '/', dirname(__DIR__, 2)), '/').'/';

        return str_starts_with($normalized, $package)
            ? substr($normalized, strlen($package))
            : $this->relativeFile($file);
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
}
