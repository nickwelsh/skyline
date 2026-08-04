<?php

namespace NickWelsh\Skyline\Persistence;

use Psr\Log\LoggerInterface;
use Throwable;

final class FailureReporter
{
    private float $lastReportedAt = 0.0;

    private int $suppressed = 0;

    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly int $intervalSeconds,
    ) {}

    public function report(Throwable $exception): void
    {
        $now = microtime(true);

        if ($now - $this->lastReportedAt < $this->intervalSeconds) {
            $this->suppressed++;

            return;
        }

        try {
            $this->logger->warning('Skyline persistence failed.', [
                'exception' => $exception,
                'suppressed_failures' => $this->suppressed,
            ]);
        } catch (Throwable) {
            // Monitoring failures cannot alter host behavior.
        }

        $this->lastReportedAt = $now;
        $this->suppressed = 0;
    }
}
