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
        private ?AttemptRegistry $attempts = null,
    ) {}

    public function export(iterable $batch, ?CancellationInterface $cancellation = null): FutureInterface
    {
        try {
            foreach ($batch as $span) {
                $attributes = $span->getAttributes();
                $runId = $attributes->get('skyline.run_id');
                $attemptNumber = $attributes->get('skyline.attempt');
                $role = $attributes->get('skyline.role');

                if (is_string($runId) && is_numeric($attemptNumber) && is_string($role)) {
                    $this->attempts?->get($runId, (int) $attemptNumber)?->recordSpan(
                        $role,
                        $span->getEndEpochNanos() - $span->getStartEpochNanos(),
                    );
                }

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
