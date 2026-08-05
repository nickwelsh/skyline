<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Process\Factory;

final class InstrumentedProcessFactory extends Factory
{
    public function __construct(private readonly ProcessInstrumentation $telemetry) {}

    public function newPendingProcess()
    {
        return (new InstrumentedPendingProcess($this, $this->telemetry))->withFakeHandlers($this->fakeHandlers);
    }
}
