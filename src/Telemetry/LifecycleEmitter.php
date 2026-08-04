<?php

namespace NickWelsh\Skyline\Telemetry;

use Psr\Log\LoggerInterface;
use Throwable;

final class LifecycleEmitter
{
    private const MAX_RECORDED_LIFECYCLES = 1024;

    /** @var array<string, true> */
    private array $recorded = [];

    /** @var list<string> */
    private array $order = [];

    public function __construct(
        private readonly TelemetrySink $sink,
        private readonly LoggerInterface $logger,
    ) {}

    public function record(LifecycleRecord $record): void
    {
        $key = implode(':', [
            $record->type->value,
            $record->runId,
            $record->attempt ?? '-',
        ]);

        if (isset($this->recorded[$key])) {
            return;
        }

        $this->recorded[$key] = true;
        $this->order[] = $key;

        if (count($this->order) > self::MAX_RECORDED_LIFECYCLES) {
            $expired = array_shift($this->order);
            unset($this->recorded[$expired]);
        }

        try {
            $this->sink->recordLifecycle($record);
        } catch (Throwable $exception) {
            try {
                $this->logger->warning('Skyline lifecycle export failed.', ['exception' => $exception]);
            } catch (Throwable) {
                // Monitoring failures cannot alter host behavior.
            }
        }
    }
}
