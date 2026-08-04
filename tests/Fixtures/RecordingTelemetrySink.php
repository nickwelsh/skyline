<?php

namespace Tests\Fixtures;

use NickWelsh\Skyline\Telemetry\LifecycleRecord;
use NickWelsh\Skyline\Telemetry\TelemetrySink;
use OpenTelemetry\SDK\Trace\SpanDataInterface;
use RuntimeException;

final class RecordingTelemetrySink implements TelemetrySink
{
    /** @var list<LifecycleRecord> */
    public array $lifecycle = [];

    /** @var list<SpanDataInterface> */
    public array $spans = [];

    public bool $throws = false;

    public function recordLifecycle(LifecycleRecord $record): void
    {
        if ($this->throws) {
            throw new RuntimeException('Sink unavailable.');
        }

        $this->lifecycle[] = $record;
    }

    public function recordSpan(SpanDataInterface $span): void
    {
        if ($this->throws) {
            throw new RuntimeException('Sink unavailable.');
        }

        $this->spans[] = $span;
    }
}
