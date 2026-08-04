<?php

namespace NickWelsh\Skyline\Telemetry;

enum AttemptResult
{
    case Completed;
    case Released;
    case RetryableFailure;
    case Failed;

    public function attemptOutcome(): string
    {
        return match ($this) {
            self::Completed => 'completed',
            self::Released => 'released',
            self::RetryableFailure, self::Failed => 'failed',
        };
    }

    public function runStatus(): string
    {
        return match ($this) {
            self::Completed => 'completed',
            self::Released, self::RetryableFailure => 'retrying',
            self::Failed => 'failed',
        };
    }

    public function priority(): int
    {
        return match ($this) {
            self::Completed => 1,
            self::Released => 2,
            self::RetryableFailure => 3,
            self::Failed => 4,
        };
    }

    public function isFailure(): bool
    {
        return $this === self::RetryableFailure || $this === self::Failed;
    }
}
