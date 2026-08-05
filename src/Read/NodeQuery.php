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
        private ExceptionPresenter $exceptions,
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
            default => $this->span($snapshot, $nodeId),
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
        $run = $snapshot->runs->firstWhere('run_id', $attempt->run_id);

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
            'exception' => $attempt->exception_class === null
                ? null
                : $this->exceptions->present($attempt, $run?->job_name),
            'metadata' => $this->spanMetadata($consumer),
        ];
    }

    /** @return array<string, mixed> */
    private function span(TraceSnapshot $snapshot, string $nodeId): array
    {
        $span = $snapshot->spans->first(fn (object $span): bool => NodeIds::span($span->span_id) === $nodeId
            && ! in_array($span->role, ['producer', 'consumer'], true));

        if ($span === null) {
            throw new RecordNotFound('The span node was not found.');
        }

        $attributes = $this->json($span->attributes);

        return match ($span->role) {
            'http' => $this->http($span, $attributes),
            'sql' => $this->sql($span, $attributes),
            default => $this->generic($span, $attributes),
        };
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function generic(object $span, array $attributes): array
    {
        return [
            'overview' => [
                'runId' => $span->run_id,
                'attemptNumber' => $span->attempt_number === null ? null : (int) $span->attempt_number,
                'traceId' => $span->trace_id,
                'spanId' => $span->span_id,
                'parentSpanId' => $span->parent_span_id,
                'operation' => $attributes['cache.operation'] ?? $attributes['db.operation.name'] ?? null,
                'store' => $attributes['cache.store'] ?? $attributes['db.namespace'] ?? null,
                'depth' => $attributes['db.transaction.depth'] ?? null,
                'outcome' => $attributes['db.transaction.outcome'] ?? null,
                'queryTimeMs' => $attributes['db.transaction.query_time_ms'] ?? null,
                'statusDescription' => $span->status_description,
            ],
            'source' => $this->source($attributes, 'skyline.'.($span->role ?: 'span').'.source'),
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function sql(object $span, array $attributes): array
    {
        $sanitizer = new PrivacySanitizer;
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
            'source' => $this->source($attributes, 'skyline.sql.source'),
            'bindings' => $this->sqlCapture($attributes, 'skyline.sql.bindings'),
            'result' => $this->sqlCapture($attributes, 'skyline.sql.result'),
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function http(object $span, array $attributes): array
    {
        $method = is_string($attributes['http.request.method'] ?? null) ? $attributes['http.request.method'] : 'HTTP';
        $url = is_string($attributes['url.full'] ?? null) ? $attributes['url.full'] : '';
        $status = $attributes['http.response.status_code'] ?? null;

        return [
            'overview' => [
                'runId' => $span->run_id,
                'attemptNumber' => $span->attempt_number === null ? null : (int) $span->attempt_number,
                'traceId' => $span->trace_id,
                'spanId' => $span->span_id,
                'parentSpanId' => $span->parent_span_id,
                'method' => $method,
                'url' => $url,
                'statusCode' => is_numeric($status) ? (int) $status : null,
                'statusDescription' => $span->status_description,
            ],
            'source' => $this->source($attributes, 'skyline.http.source'),
            'http' => [
                'method' => $method,
                'url' => $url,
                'statusCode' => is_numeric($status) ? (int) $status : null,
                'request' => [
                    'headers' => $this->httpHeaders($attributes, 'skyline.http.request.headers'),
                    'body' => $this->httpBody($attributes, 'skyline.http.request.body'),
                ],
                'response' => [
                    'headers' => $this->httpHeaders($attributes, 'skyline.http.response.headers'),
                    'body' => $this->httpBody($attributes, 'skyline.http.response.body'),
                ],
            ],
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
            $attributes['skyline.http.request.headers'],
            $attributes['skyline.http.request.body'],
            $attributes['skyline.http.response.headers'],
            $attributes['skyline.http.response.body'],
            $attributes['skyline.http.source.file'],
            $attributes['skyline.http.source.line'],
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
    private function source(array $attributes, string $prefix): ?array
    {
        $file = $attributes[$prefix.'.file'] ?? null;
        $line = $attributes[$prefix.'.line'] ?? null;

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

    /** @param array<string, mixed> $attributes @return array{items: array<string, list<string>>, truncated: bool}|null */
    private function httpHeaders(array $attributes, string $key): ?array
    {
        $capture = $this->sqlCapture($attributes, $key);

        return is_array($capture['items'] ?? null) ? [
            'items' => $capture['items'],
            'truncated' => (bool) ($capture['truncated'] ?? false),
        ] : null;
    }

    /** @param array<string, mixed> $attributes @return array{value: string, contentType: string|null, originalBytes: int, truncated: bool, isJson: bool, json: mixed}|null */
    private function httpBody(array $attributes, string $key): ?array
    {
        $capture = $this->sqlCapture($attributes, $key);
        $value = $capture['value'] ?? null;

        if (! is_string($value)) {
            return null;
        }

        $json = null;
        $isJson = false;

        try {
            $json = json_decode($value, true, flags: JSON_THROW_ON_ERROR);
            $isJson = true;
        } catch (Throwable) {
            // Text bodies remain available as text.
        }

        return [
            'value' => $value,
            'contentType' => is_string($capture['contentType'] ?? null) ? $capture['contentType'] : null,
            'originalBytes' => is_numeric($capture['originalBytes'] ?? null) ? (int) $capture['originalBytes'] : strlen($value),
            'truncated' => (bool) ($capture['truncated'] ?? false),
            'isJson' => $isJson,
            'json' => $json,
        ];
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
