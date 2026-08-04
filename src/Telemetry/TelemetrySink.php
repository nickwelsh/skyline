<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\SDK\Trace\SpanDataInterface;

interface TelemetrySink
{
    public function recordLifecycle(LifecycleRecord $record): void;

    public function recordSpan(SpanDataInterface $span): void;
}
