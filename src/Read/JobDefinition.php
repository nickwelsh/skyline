<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Contracts\Config\Repository;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use ReflectionClass;
use Throwable;

final readonly class JobDefinition
{
    public function __construct(
        private SkylineConnection $database,
        private Repository $config,
        private EditorLink $editorLink,
    ) {}

    /** @return array<string, mixed> */
    public function for(string $jobName): array
    {
        $attributes = $this->capturedAttributes($jobName);
        $defaults = $this->classDefaults($jobName);
        $file = $this->string($attributes['laravel.job.file'] ?? null) ?? $defaults['file'];
        $line = $this->integer($attributes['laravel.job.file_line'] ?? null) ?? $defaults['line'];
        $connection = $this->string($attributes['laravel.job.default_connection'] ?? null)
            ?? $this->string($defaults['connection'])
            ?? (string) $this->config->get('queue.default', 'sync');
        $configuredQueue = $this->config->get("queue.connections.{$connection}.queue", 'default');
        $queue = $this->string($attributes['laravel.job.default_queue'] ?? null)
            ?? $this->string($defaults['queue'])
            ?? (is_string($configuredQueue) && $configuredQueue !== '' ? $configuredQueue : 'default');

        return [
            'file' => $file === null ? null : [
                'path' => $this->relativePath($file),
                'href' => $this->editorLink->href($file, $line),
            ],
            'defaultQueue' => ['connection' => $connection, 'queue' => $queue],
            'retry' => [
                'maxAttempts' => $this->integer($attributes['laravel.job.max_tries'] ?? null)
                    ?? $this->integer($defaults['tries']),
                'backoffSeconds' => $this->backoff($attributes['laravel.job.backoff'] ?? $defaults['backoff']),
                'retryUntil' => $this->retryUntil($attributes['laravel.job.retry_until'] ?? $defaults['retryUntil']),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function capturedAttributes(string $jobName): array
    {
        $value = $this->database->get()->table('skyline_spans')
            ->join('skyline_runs', 'skyline_runs.run_id', '=', 'skyline_spans.run_id')
            ->where('skyline_runs.job_name', $jobName)
            ->where('skyline_spans.role', 'producer')
            ->orderByDesc('skyline_runs.triggered_at')
            ->value('skyline_spans.attributes');

        if (! is_string($value)) {
            return [];
        }
        try {
            $decoded = json_decode($value, true, flags: JSON_THROW_ON_ERROR);

            return is_array($decoded) ? $decoded : [];
        } catch (Throwable) {
            return [];
        }
    }

    /** @return array{file: ?string, line: ?int, connection: mixed, queue: mixed, tries: mixed, backoff: mixed, retryUntil: mixed} */
    private function classDefaults(string $jobName): array
    {
        $empty = ['file' => null, 'line' => null, 'connection' => null, 'queue' => null, 'tries' => null, 'backoff' => null, 'retryUntil' => null];
        if (! class_exists($jobName)) {
            return $empty;
        }
        try {
            $reflection = new ReflectionClass($jobName);
            $properties = $reflection->getDefaultProperties();
            $file = $reflection->getFileName();

            return [
                'file' => is_string($file) ? $file : null,
                'line' => $reflection->getStartLine(),
                'connection' => $properties['connection'] ?? null,
                'queue' => $properties['queue'] ?? null,
                'tries' => $properties['tries'] ?? null,
                'backoff' => $properties['backoff'] ?? null,
                'retryUntil' => $properties['retryUntil'] ?? null,
            ];
        } catch (Throwable) {
            return $empty;
        }
    }

    /** @return list<int>|null */
    private function backoff(mixed $value): ?array
    {
        if (is_string($value)) {
            $value = explode(',', $value);
        } elseif (is_int($value)) {
            $value = [$value];
        }
        if (! is_array($value) || $value === [] || array_filter($value, fn (mixed $item): bool => ! is_numeric($item)) !== []) {
            return null;
        }

        return array_values(array_map('intval', $value));
    }

    private function retryUntil(mixed $value): ?string
    {
        $timestamp = $this->integer($value);

        return $timestamp === null ? null : gmdate('Y-m-d\\TH:i:s\\Z', $timestamp);
    }

    private function relativePath(string $file): string
    {
        $base = rtrim(str_replace('\\', '/', base_path()), '/').'/';
        $normalized = str_replace('\\', '/', $file);

        return str_starts_with($normalized, $base) ? substr($normalized, strlen($base)) : $normalized;
    }

    private function string(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function integer(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }
}
