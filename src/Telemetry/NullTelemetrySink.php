<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\SDK\Trace\SpanDataInterface;

final class NullTelemetrySink implements TelemetrySink
{
    public function recordLifecycle(LifecycleRecord $record): void {}

    public function recordSpan(SpanDataInterface $span): void {}
}
