<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Process\PendingProcess;
use Throwable;

final class InstrumentedPendingProcess extends PendingProcess
{
    public function __construct($factory, private readonly ProcessInstrumentation $telemetry)
    {
        parent::__construct($factory);
    }

    public function run(array|string|null $command = null, ?callable $output = null)
    {
        $span = $this->telemetry->start($command ?? $this->command, $this->timeout, false);

        try {
            $result = parent::run($command, $output);
            $span?->complete($result);

            return $result;
        } catch (Throwable $exception) {
            $span?->fail($exception);

            throw $exception;
        }
    }

    public function start(array|string|null $command = null, ?callable $output = null)
    {
        $span = $this->telemetry->start($command ?? $this->command, $this->timeout, true);

        try {
            $process = parent::start($command, $output);

            return $span === null ? $process : new InstrumentedInvokedProcess($process, $span);
        } catch (Throwable $exception) {
            $span?->fail($exception);

            throw $exception;
        }
    }
}
