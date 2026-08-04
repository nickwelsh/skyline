<?php

namespace App\Telemetry;

use OpenTelemetry\SDK\Common\Future\CancellationInterface;
use OpenTelemetry\SDK\Common\Future\CompletedFuture;
use OpenTelemetry\SDK\Common\Future\FutureInterface;
use OpenTelemetry\SDK\Trace\SpanDataInterface;
use OpenTelemetry\SDK\Trace\SpanExporterInterface;
use Throwable;

final class JsonlSpanExporter implements SpanExporterInterface
{
    public function __construct(private readonly string $path) {}

    public function export(iterable $batch, ?CancellationInterface $cancellation = null): FutureInterface
    {
        try {
            foreach ($batch as $span) {
                file_put_contents(
                    $this->path,
                    json_encode($this->serialize($span), JSON_THROW_ON_ERROR).PHP_EOL,
                    FILE_APPEND | LOCK_EX,
                );
            }

            return new CompletedFuture(true);
        } catch (Throwable) {
            return new CompletedFuture(false);
        }
    }

    public function shutdown(?CancellationInterface $cancellation = null): bool
    {
        return true;
    }

    public function forceFlush(?CancellationInterface $cancellation = null): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    private function serialize(SpanDataInterface $span): array
    {
        return [
            'name' => $span->getName(),
            'trace_id' => $span->getTraceId(),
            'span_id' => $span->getSpanId(),
            'parent_span_id' => $span->getParentSpanId(),
            'kind' => $span->getKind(),
            'status' => $span->getStatus()->getCode(),
            'status_description' => $span->getStatus()->getDescription(),
            'start_ns' => $span->getStartEpochNanos(),
            'end_ns' => $span->getEndEpochNanos(),
            'attributes' => $span->getAttributes()->toArray(),
            'events' => array_map(static fn ($event) => [
                'name' => $event->getName(),
                'timestamp_ns' => $event->getEpochNanos(),
                'attributes' => $event->getAttributes()->toArray(),
            ], $span->getEvents()),
        ];
    }
}
