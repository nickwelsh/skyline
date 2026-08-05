<?php

namespace NickWelsh\Skyline\Telemetry;

use OpenTelemetry\API\Trace\TracerInterface;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Trace\Sampler\AlwaysOnSampler;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use Psr\Log\LoggerInterface;

final readonly class SkylineTracer
{
    private TracerInterface $tracer;

    public function __construct(TelemetrySink $sink, LoggerInterface $logger, AttemptRegistry $attempts)
    {
        $provider = new TracerProvider(
            new SimpleSpanProcessor(new SinkSpanExporter($sink, $logger, $attempts)),
            new AlwaysOnSampler,
            ResourceInfo::create(Attributes::create([])),
        );

        $this->tracer = $provider->getTracer('nickwelsh/skyline');
    }

    public function get(): TracerInterface
    {
        return $this->tracer;
    }
}
