<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use OpenTelemetry\API\Trace\SpanKind;

final class ProcessInstrumentation
{
    /** @var array<int, ProcessSpan> */
    private array $pending = [];

    public function __construct(
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
    ) {}

    /** @param array<array-key, string>|string|null $command */
    public function start(array|string|null $command, ?int $timeout, bool $async): ?ProcessSpan
    {
        $active = $this->attempts->current();

        if ($active === null || ! (bool) $this->config->get('skyline.process.enabled', true)) {
            return null;
        }

        $attributes = [
            'skyline.role' => 'process',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'process.executable.name' => $this->executable($command),
            'process.async' => $async,
        ];

        if ($timeout !== null) {
            $attributes['process.timeout_seconds'] = $timeout;
        }

        if ((bool) $this->config->get('skyline.process.capture_source', false)) {
            $attributes = [...$attributes, ...$this->source->attributes('skyline.process.source')];
        }

        $span = new ProcessSpan(
            $this->tracer->get()->spanBuilder('Process '.$attributes['process.executable.name'])
                ->setParent($active->context)
                ->setSpanKind(SpanKind::KIND_INTERNAL)
                ->setAttributes($attributes)
                ->startSpan(),
            $active->runId,
            $active->number,
            fn (ProcessSpan $completed) => $this->forget($completed),
        );
        $this->pending[spl_object_id($span)] = $span;

        return $span;
    }

    public function finishAttempt(ActiveAttempt $attempt): void
    {
        foreach ($this->pending as $span) {
            if ($span->runId === $attempt->runId && $span->attempt === $attempt->number) {
                $span->incomplete();
            }
        }
    }

    /** @param array<array-key, string>|string|null $command */
    private function executable(array|string|null $command): string
    {
        $value = is_array($command)
            ? ($command[0] ?? 'process')
            : (strtok(trim((string) $command), " \t") ?: 'process');
        $value = trim((string) $value, "'\"");

        return mb_strcut(basename($value), 0, 128, 'UTF-8');
    }

    private function forget(ProcessSpan $span): void
    {
        unset($this->pending[spl_object_id($span)]);
    }
}
