<?php

namespace NickWelsh\Skyline\Telemetry;

enum Lifecycle: string
{
    case RunDispatched = 'run.dispatched';
    case RunQueued = 'run.queued';
    case RunProcessing = 'run.processing';
    case AttemptStarted = 'attempt.started';
    case AttemptException = 'attempt.exception';
    case AttemptFinished = 'attempt.finished';
}
