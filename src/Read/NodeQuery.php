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
            'breadcrumb' => $this->breadcrumb($snapshot, $nodeId),
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
            'source' => $this->jobSource($run->job_name),
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
        $consumerAttributes = $consumer === null ? [] : $this->json($consumer->attributes);

        $summary = $this->attemptSummary($consumerAttributes);

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
            'summary' => $summary,
            'presentation' => $summary === null
                ? ['type' => 'generic']
                : ['type' => 'summary', 'summary' => $summary],
            'metadata' => $this->spanMetadata($consumer),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed>|null */
    private function attemptSummary(array $attributes): ?array
    {
        if (! isset($attributes['skyline.summary.memory_peak_bytes'])) {
            return null;
        }

        $operations = [];

        foreach ($attributes as $key => $count) {
            if (! is_string($key) || ! preg_match('/^skyline\.summary\.([^.]+)\.count$/', $key, $matches)) {
                continue;
            }

            $duration = $attributes['skyline.summary.'.$matches[1].'.duration_ms'] ?? 0;
            $operations[$matches[1]] = [
                'count' => is_numeric($count) ? (int) $count : 0,
                'durationMs' => is_numeric($duration) ? (float) $duration : 0.0,
            ];
        }

        return [
            'resources' => [
                'peakMemoryBytes' => (int) $attributes['skyline.summary.memory_peak_bytes'],
                'memoryDeltaBytes' => (int) ($attributes['skyline.summary.memory_delta_bytes'] ?? 0),
                'cpuTimeUs' => (int) ($attributes['skyline.summary.cpu_time_us'] ?? 0),
            ],
            'operations' => $operations,
        ];
    }

    /** @return array<string, mixed> */
    private function breadcrumb(TraceSnapshot $snapshot, string $nodeId): array
    {
        foreach ($snapshot->spans->where('role', 'consumer') as $consumer) {
            foreach ($this->json($consumer->events) as $index => $event) {
                if (($event['name'] ?? null) !== 'log' || NodeIds::breadcrumb($consumer->span_id, (int) $index) !== $nodeId) {
                    continue;
                }

                $attributes = is_array($event['attributes'] ?? null) ? $event['attributes'] : [];
                $context = is_string($attributes['log.context'] ?? null)
                    ? $this->json($attributes['log.context'])
                    : [];
                $level = is_string($attributes['log.level'] ?? null) ? strtolower($attributes['log.level']) : 'warning';
                $channel = is_string($attributes['log.channel'] ?? null) ? $attributes['log.channel'] : 'default';
                $message = is_string($attributes['log.message'] ?? null) ? $attributes['log.message'] : '';
                $timestamp = isset($event['timestamp']) ? (int) $event['timestamp'] : (int) $consumer->started_at;

                return [
                    'overview' => [
                        'runId' => $consumer->run_id,
                        'attemptNumber' => $consumer->attempt_number === null ? null : (int) $consumer->attempt_number,
                        'traceId' => $consumer->trace_id,
                        'spanId' => $consumer->span_id,
                        'parentSpanId' => $consumer->parent_span_id,
                        'level' => $level,
                        'channel' => $channel,
                        'loggedAt' => Nanoseconds::toRfc3339($timestamp),
                    ],
                    'breadcrumb' => [
                        'timestamp' => Nanoseconds::toRfc3339($timestamp),
                        'level' => $level,
                        'channel' => $channel,
                        'message' => $message,
                        'context' => $context,
                    ],
                    'presentation' => [
                        'type' => 'breadcrumb',
                        'breadcrumb' => [
                            'timestamp' => Nanoseconds::toRfc3339($timestamp),
                            'level' => $level,
                            'channel' => $channel,
                            'message' => $message,
                            'context' => $context,
                        ],
                    ],
                    'metadata' => ['value' => [], 'isTruncated' => false, 'truncated' => []],
                ];
            }
        }

        throw new RecordNotFound('The breadcrumb node was not found.');
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
        $details = match ($span->role) {
            'cache' => ['cache' => $this->cache($attributes)],
            'redis' => ['redis' => $this->redis($span, $attributes)],
            'storage' => ['storage' => $this->storage($attributes)],
            'mail', 'notification' => ['delivery' => $this->delivery($span->role, $attributes)],
            'process' => ['process' => $this->process($attributes)],
            'transaction' => ['transaction' => $this->transaction($attributes)],
            'custom' => ['custom' => $this->custom($span, $attributes)],
            default => [],
        };
        $presentation = match ($span->role) {
            'storage' => ['type' => 'storage', 'storage' => $details['storage']],
            'mail', 'notification' => ['type' => 'delivery', 'delivery' => $details['delivery']],
            'process' => ['type' => 'process', 'process' => $details['process']],
            'custom' => ['type' => 'custom', 'custom' => $details['custom']],
            default => ['type' => 'generic'],
        };

        return [
            'overview' => [
                'runId' => $span->run_id,
                'attemptNumber' => $span->attempt_number === null ? null : (int) $span->attempt_number,
                'traceId' => $span->trace_id,
                'spanId' => $span->span_id,
                'parentSpanId' => $span->parent_span_id,
                'operation' => $attributes['cache.operation'] ?? $attributes['storage.operation'] ?? $attributes['db.operation.name'] ?? null,
                'store' => $attributes['cache.store'] ?? $attributes['storage.disk'] ?? $attributes['db.namespace'] ?? null,
                'hit' => $attributes['cache.hit'] ?? null,
                'key' => $attributes['cache.key'] ?? null,
                'ttl' => $attributes['cache.ttl'] ?? null,
                'driver' => $attributes['storage.driver'] ?? null,
                'bytes' => $attributes['storage.bytes'] ?? null,
                'executable' => $attributes['process.executable.name'] ?? null,
                'exitCode' => $attributes['process.exit_code'] ?? null,
                'deliveryOutcome' => $attributes['messaging.operation.outcome'] ?? null,
                'messageType' => $attributes['messaging.message.type'] ?? null,
                'transportOrChannel' => $attributes['messaging.destination.name'] ?? null,
                'recipientCount' => $attributes['messaging.destination.recipient_count'] ?? null,
                'processOutcome' => $attributes['process.outcome'] ?? null,
                'depth' => $attributes['db.transaction.depth'] ?? null,
                'outcome' => $attributes['db.transaction.outcome'] ?? null,
                'queryTimeMs' => $attributes['db.transaction.query_time_ms'] ?? null,
                'statusDescription' => $span->status_description,
            ],
            'source' => $this->source($attributes, 'skyline.'.($span->role ?: 'span').'.source'),
            'presentation' => [
                ...$presentation,
                'timing' => $this->timing($span),
                'failure' => $this->failure($span, $attributes),
            ],
            ...$details,
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function cache(array $attributes): array
    {
        return [
            'operation' => $attributes['cache.operation'] ?? null,
            'store' => $attributes['cache.store'] ?? null,
            'key' => $attributes['cache.key'] ?? null,
            'keyCaptured' => (bool) ($attributes['cache.key_captured'] ?? false),
            'keyCount' => isset($attributes['cache.key_count']) ? (int) $attributes['cache.key_count'] : 1,
            'strategy' => $attributes['cache.strategy'] ?? null,
            'outcome' => $attributes['cache.outcome'] ?? null,
            'hit' => isset($attributes['cache.hit']) ? (bool) $attributes['cache.hit'] : null,
            'ttlSeconds' => isset($attributes['cache.ttl']) ? (int) $attributes['cache.ttl'] : null,
            'freshTtlSeconds' => isset($attributes['cache.fresh_ttl']) ? (int) $attributes['cache.fresh_ttl'] : null,
            'forever' => (bool) ($attributes['cache.forever'] ?? false),
            'value' => $this->valueCapture($attributes, 'cache.value'),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function redis(object $span, array $attributes): array
    {
        return [
            'command' => $attributes['db.operation.name'] ?? null,
            'connection' => $attributes['db.namespace'] ?? null,
            'outcome' => strtolower((string) $span->status_code) === 'error' ? 'failed' : 'completed',
            'arguments' => $this->valueCapture($attributes, 'db.operation.arguments'),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function storage(array $attributes): array
    {
        $localFile = $attributes['storage.local_file'] ?? null;
        $destinationLocalFile = $attributes['storage.destination.local_file'] ?? null;

        return [
            'operation' => $attributes['storage.operation'] ?? null,
            'disk' => $attributes['storage.disk'] ?? null,
            'driver' => $attributes['storage.driver'] ?? null,
            'path' => $attributes['storage.path'] ?? null,
            'pathCaptured' => (bool) ($attributes['storage.path_captured'] ?? false),
            'destination' => $attributes['storage.destination.path'] ?? $attributes['storage.destination'] ?? null,
            'destinationCaptured' => (bool) ($attributes['storage.destination.path_captured'] ?? false),
            'bytes' => isset($attributes['storage.bytes']) ? (int) $attributes['storage.bytes'] : null,
            'outcome' => $attributes['storage.outcome'] ?? null,
            'url' => $attributes['storage.url'] ?? null,
            'destinationUrl' => $attributes['storage.destination.url'] ?? null,
            'localFile' => is_string($localFile) ? [
                'path' => $localFile,
                'href' => $this->editorLink->href($localFile, 1),
            ] : null,
            'destinationLocalFile' => is_string($destinationLocalFile) ? [
                'path' => $destinationLocalFile,
                'href' => $this->editorLink->href($destinationLocalFile, 1),
            ] : null,
            'content' => $this->valueCapture($attributes, 'storage.content'),
            'result' => [
                'exists' => isset($attributes['storage.result.exists']) ? (bool) $attributes['storage.result.exists'] : null,
                'lastModified' => isset($attributes['storage.result.last_modified']) ? (int) $attributes['storage.result.last_modified'] : null,
                'mimeType' => $attributes['storage.result.mime_type'] ?? null,
                'visibility' => $attributes['storage.result.visibility'] ?? null,
            ],
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function delivery(string $kind, array $attributes): array
    {
        $recipients = $this->sqlCapture($attributes, 'messaging.destination.recipients');

        return [
            'kind' => $kind,
            'messageType' => $attributes['messaging.message.type'] ?? null,
            'transportOrChannel' => $attributes['messaging.destination.name'] ?? null,
            'recipientCount' => isset($attributes['messaging.destination.recipient_count']) ? (int) $attributes['messaging.destination.recipient_count'] : null,
            'outcome' => $attributes['messaging.operation.outcome'] ?? null,
            'recipients' => is_array($recipients) ? $recipients : null,
            'recipientIdentity' => $this->valueCapture($attributes, 'messaging.destination.identity'),
            'subject' => $this->textCapture($attributes, 'messaging.message.subject'),
            'text' => $this->textCapture($attributes, 'messaging.message.text'),
            'html' => $this->textCapture($attributes, 'messaging.message.html'),
            'messageData' => $this->valueCapture($attributes, 'messaging.message.data'),
            'operationData' => $this->valueCapture($attributes, 'messaging.operation.data'),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function process(array $attributes): array
    {
        return [
            'executable' => $attributes['process.executable.name'] ?? null,
            'async' => (bool) ($attributes['process.async'] ?? false),
            'timeoutSeconds' => isset($attributes['process.timeout_seconds']) ? (int) $attributes['process.timeout_seconds'] : null,
            'exitCode' => isset($attributes['process.exit_code']) ? (int) $attributes['process.exit_code'] : null,
            'timedOut' => (bool) ($attributes['process.timed_out'] ?? false),
            'outcome' => $attributes['process.outcome'] ?? null,
            'command' => $this->valueCapture($attributes, 'process.command'),
            'environment' => $this->valueCapture($attributes, 'process.environment'),
            'input' => $this->valueCapture($attributes, 'process.input'),
            'stdout' => $this->valueCapture($attributes, 'process.stdout'),
            'stderr' => $this->valueCapture($attributes, 'process.stderr'),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function transaction(array $attributes): array
    {
        return [
            'connection' => $attributes['db.namespace'] ?? null,
            'driver' => $attributes['db.system.name'] ?? null,
            'depth' => isset($attributes['db.transaction.depth']) ? (int) $attributes['db.transaction.depth'] : null,
            'outcome' => $attributes['db.transaction.outcome'] ?? null,
            'queryTimeMs' => isset($attributes['db.transaction.query_time_ms']) ? (float) $attributes['db.transaction.query_time_ms'] : null,
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function custom(object $span, array $attributes): array
    {
        $application = array_filter(
            $attributes,
            fn (mixed $value, string|int $key): bool => is_string($key)
                && ! str_starts_with($key, 'skyline.')
                && ! str_starts_with($key, 'error.'),
            ARRAY_FILTER_USE_BOTH,
        );

        $sanitized = (new PrivacySanitizer)->metadata($application);

        return [
            'name' => $span->name,
            'attributes' => $sanitized['value'],
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
            'presentation' => [
                'type' => 'generic',
                'timing' => $this->timing($span),
                'failure' => $this->failure($span, $attributes),
            ],
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function http(object $span, array $attributes): array
    {
        $method = is_string($attributes['http.request.method'] ?? null) ? $attributes['http.request.method'] : 'HTTP';
        $url = is_string($attributes['url.full'] ?? null) ? $attributes['url.full'] : '';
        $status = $attributes['http.response.status_code'] ?? null;

        $http = [
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
        ];

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
            'http' => $http,
            'presentation' => [
                'type' => 'http',
                'http' => $http,
                'timing' => $this->timing($span),
                'failure' => $this->failure($span, $attributes),
            ],
            'metadata' => $this->spanMetadata($span),
        ];
    }

    /** @return array{startedAt: string|null, endedAt: string|null, durationUs: int|null} */
    private function timing(object $span): array
    {
        $startedAt = isset($span->started_at) ? (int) $span->started_at : null;
        $endedAt = isset($span->ended_at) ? (int) $span->ended_at : null;

        return [
            'startedAt' => Nanoseconds::toRfc3339($startedAt),
            'endedAt' => Nanoseconds::toRfc3339($endedAt),
            'durationUs' => $startedAt === null || $endedAt === null ? null : intdiv(max(0, $endedAt - $startedAt), 1000),
        ];
    }

    /** @param array<string, mixed> $attributes @return array{type: string|null, message: string|null}|null */
    private function failure(object $span, array $attributes): ?array
    {
        if (strtolower((string) $span->status_code) !== 'error'
            && ! is_string($attributes['error.type'] ?? null)
            && ! is_string($span->status_description)) {
            return null;
        }

        return [
            'type' => is_string($attributes['error.type'] ?? null) ? $attributes['error.type'] : null,
            'message' => is_string($span->status_description) ? $span->status_description : null,
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

    /** @param array<string, mixed> $attributes @return array{type: string, value: mixed, originalBytes: int, truncated: bool}|null */
    private function valueCapture(array $attributes, string $key): ?array
    {
        $capture = $this->sqlCapture($attributes, $key);

        if (! is_string($capture['type'] ?? null) || ! array_key_exists('value', $capture)) {
            return null;
        }

        return [
            'type' => $capture['type'],
            'value' => $capture['value'],
            'originalBytes' => is_numeric($capture['originalBytes'] ?? null) ? (int) $capture['originalBytes'] : 0,
            'truncated' => (bool) ($capture['truncated'] ?? false),
        ];
    }

    /** @param array<string, mixed> $attributes @return array{value: string, truncated: bool}|null */
    private function textCapture(array $attributes, string $key): ?array
    {
        $value = $attributes[$key] ?? null;

        return is_string($value) ? [
            'value' => $value,
            'truncated' => (bool) ($attributes[$key.'_truncated'] ?? false),
        ] : null;
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

    /** @return array{file: string, line: int, href: string|null}|null */
    private function jobSource(string $jobName): ?array
    {
        try {
            if (! class_exists($jobName)) {
                return null;
            }

            $reflection = new \ReflectionClass($jobName);
            $file = $reflection->getFileName();

            if ($file === false) {
                return null;
            }

            $line = max(1, $reflection->getStartLine());

            return [
                'file' => $this->relativeSourceFile($file),
                'line' => $line,
                'href' => $this->editorLink->href($file, $line),
            ];
        } catch (Throwable) {
            return null;
        }
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
