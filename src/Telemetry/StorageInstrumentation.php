<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use Throwable;

final class StorageInstrumentation
{
    public function __construct(
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
    ) {}

    /** @param list<string> $paths */
    public function record(string $disk, string $driver, string $operation, array $paths, callable $callback, ?int $bytes = null): mixed
    {
        $active = $this->attempts->current();

        if ($active === null || ! (bool) $this->config->get('skyline.storage.enabled', true)) {
            return $callback();
        }

        $attributes = [
            'skyline.role' => 'storage',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'storage.disk' => $disk,
            'storage.driver' => $driver,
            'storage.operation' => $operation,
        ];

        foreach ($paths as $index => $path) {
            $prefix = $index === 0 ? 'storage' : 'storage.destination';
            $attributes[$prefix.'.path'] = $this->path($path);
            $attributes[$prefix.'.path_captured'] = (bool) $this->config->get('skyline.storage.capture_paths', false);

            if (! (bool) $this->config->get('skyline.storage.capture_paths', false)) {
                continue;
            }

            if (($url = $this->url($disk, $path)) !== null) {
                $attributes[$prefix.'.url'] = $url;
            }

            if ($driver === 'local' && ($localFile = $this->localFile($disk, $path)) !== null) {
                $attributes[$prefix.'.local_file'] = $localFile;
            }
        }

        if ($bytes !== null) {
            $attributes['storage.bytes'] = max(0, $bytes);
        }

        if ((bool) $this->config->get('skyline.storage.capture_source', false)) {
            $attributes = [...$attributes, ...$this->source->attributes('skyline.storage.source')];
        }

        $span = $this->tracer->get()->spanBuilder('Storage '.strtoupper($operation))
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setAttributes($attributes)
            ->startSpan();

        try {
            $result = $callback();

            if ($bytes === null && $operation === 'read' && is_string($result)) {
                $span->setAttribute('storage.bytes', strlen($result));
            } elseif ($bytes === null && $operation === 'read_stream' && is_resource($result)) {
                $stat = fstat($result);

                if (is_array($stat) && is_int($stat['size'] ?? null)) {
                    $span->setAttribute('storage.bytes', max(0, $stat['size']));
                }
            } elseif ($bytes === null && $operation === 'size' && is_int($result)) {
                $span->setAttribute('storage.bytes', $result);
            }

            match ($operation) {
                'exists', 'directory_exists' => $span->setAttribute('storage.result.exists', (bool) $result),
                'last_modified' => $span->setAttribute('storage.result.last_modified', (int) $result),
                'mime_type' => $span->setAttribute('storage.result.mime_type', (string) $result),
                'visibility' => $span->setAttribute('storage.result.visibility', (string) $result),
                default => null,
            };

            $span->setAttribute('storage.outcome', 'completed');

            $span->setStatus(StatusCode::STATUS_OK);

            return $result;
        } catch (Throwable $exception) {
            $span->setAttribute('error.type', $exception::class);
            $span->setAttribute('storage.outcome', 'failed');
            $span->setStatus(StatusCode::STATUS_ERROR);

            throw $exception;
        } finally {
            $span->end();
        }
    }

    private function path(string $path): string
    {
        if ((bool) $this->config->get('skyline.storage.capture_paths', false)) {
            return mb_strcut($path, 0, max(16, (int) $this->config->get('skyline.storage.max_path_bytes', 512)), 'UTF-8');
        }

        return 'sha256:'.substr(hash('sha256', $path), 0, 16);
    }

    private function url(string $disk, string $path): ?string
    {
        $template = $this->config->get('skyline.storage.links.'.$disk)
            ?? $this->config->get('filesystems.disks.'.$disk.'.url');

        if (! is_string($template) || $template === '') {
            return null;
        }

        $encoded = collect(explode('/', ltrim($path, '/')))
            ->map(fn (string $segment): string => rawurlencode($segment))
            ->implode('/');

        return str_contains($template, '{path}')
            ? str_replace('{path}', $encoded, $template)
            : rtrim($template, '/').'/'.$encoded;
    }

    private function localFile(string $disk, string $path): ?string
    {
        $root = $this->config->get('filesystems.disks.'.$disk.'.root');

        if (! is_string($root) || $root === '') {
            return null;
        }

        return rtrim($root, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.ltrim($path, DIRECTORY_SEPARATOR);
    }
}
