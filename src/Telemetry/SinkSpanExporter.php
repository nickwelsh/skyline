<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\SDK\Common\Future\CancellationInterface;
use OpenTelemetry\SDK\Common\Future\CompletedFuture;
use OpenTelemetry\SDK\Common\Future\FutureInterface;
use OpenTelemetry\SDK\Trace\SpanExporterInterface;
use Psr\Log\LoggerInterface;
use Throwable;

final readonly class SinkSpanExporter implements SpanExporterInterface
{
    public function __construct(
        private TelemetrySink $sink,
        private LoggerInterface $logger,
    ) {}

    public function export(iterable $batch, ?CancellationInterface $cancellation = null): FutureInterface
    {
        try {
            foreach ($batch as $span) {
                $this->sink->recordSpan($span);
            }

            return new CompletedFuture(true);
        } catch (Throwable $exception) {
            try {
                $this->logger->warning('Skyline span export failed.', ['exception' => $exception]);
            } catch (Throwable) {
                // Monitoring failures cannot alter host behavior.
            }

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
}
