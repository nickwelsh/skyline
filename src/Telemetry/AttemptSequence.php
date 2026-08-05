<?php

namespace NickWelsh\Skyline\Telemetry;

use NickWelsh\Skyline\Persistence\FailureReporter;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use Throwable;

final class AttemptSequence
{
    private const MAX_TRACKED_RUNS = 1024;

    /** @var array<string, int> */
    private array $lastAssigned = [];

    /** @var list<string> */
    private array $order = [];

    public function __construct(
        private readonly SkylineConnection $database,
        private readonly PersistenceGuard $guard,
        private readonly FailureReporter $failures,
        private readonly TelemetrySink $sink,
    ) {}

    public function next(string $runId, int $reported): int
    {
        $last = $this->lastAssigned[$runId] ?? $this->persistedMaximum($runId);
        $number = max(1, $reported, $last + 1);

        if (! isset($this->lastAssigned[$runId])) {
            $this->order[] = $runId;
        }

        $this->lastAssigned[$runId] = $number;

        if (count($this->order) > self::MAX_TRACKED_RUNS) {
            $expired = array_shift($this->order);
            unset($this->lastAssigned[$expired]);
        }

        return $number;
    }

    private function persistedMaximum(string $runId): int
    {
        if (! $this->sink instanceof PersistentTelemetrySink) {
            return 0;
        }

        try {
            $maximum = $this->guard->run(
                fn () => $this->database->get()->table('skyline_attempts')
                    ->where('run_id', $runId)
                    ->max('attempt_number'),
            );

            return is_numeric($maximum) ? max(0, (int) $maximum) : 0;
        } catch (Throwable $exception) {
            $this->failures->report($exception);

            return 0;
        }
    }
}
