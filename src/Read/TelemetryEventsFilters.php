<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class TelemetryEventsFilters
{
    private const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

    /** @var array<string, int|null> */
    private const PERIODS = [
        '1h' => 3_600_000_000_000,
        '24h' => 86_400_000_000_000,
        '7d' => 604_800_000_000_000,
        '30d' => 2_592_000_000_000_000,
        'all' => null,
    ];

    /** @param list<string> $levels */
    private function __construct(
        public array $levels,
        public ?string $jobType,
        public ?string $runId,
        public string $period,
        public ?int $from,
    ) {}

    public static function fromRequest(Request $request, int $observedAt): self
    {
        $levels = $request->query('levels', []);
        if (! is_array($levels) || count($levels) > count(self::LEVELS)) {
            throw new InvalidQuery('The level filter is invalid.');
        }
        $levels = array_values(array_unique($levels));
        if (array_filter($levels, fn (mixed $level): bool => ! is_string($level) || ! in_array($level, self::LEVELS, true)) !== []) {
            throw new InvalidQuery('The level filter is invalid.');
        }

        $jobType = self::string($request, 'jobType', 'Job type');
        $runId = self::string($request, 'runId', 'Run identity');
        $period = $request->query('period', 'all');
        if (! is_string($period) || ! array_key_exists($period, self::PERIODS)) {
            throw new InvalidQuery('The time range filter is invalid.');
        }
        $duration = self::PERIODS[$period];

        return new self($levels, $jobType, $runId, $period, $duration === null ? null : $observedAt - $duration);
    }

    public function applyQuery(Builder $events): Builder
    {
        return $events
            ->when($this->levels !== [], fn (Builder $events): Builder => $events->whereIn('skyline_telemetry_events.level', $this->levels))
            ->when($this->jobType !== null, fn (Builder $events): Builder => $events->where('skyline_runs.job_name', $this->jobType))
            ->when($this->runId !== null, fn (Builder $events): Builder => $events->where('skyline_telemetry_events.run_id', $this->runId))
            ->when($this->from !== null, fn (Builder $events): Builder => $events->where('skyline_telemetry_events.occurred_at', '>=', $this->from));
    }

    /** @return array{levels: list<string>, jobType: ?string, runId: ?string, period: string} */
    public function toArray(): array
    {
        return ['levels' => $this->levels, 'jobType' => $this->jobType, 'runId' => $this->runId, 'period' => $this->period];
    }

    /** @return list<string> */
    public static function levelOptions(): array
    {
        return self::LEVELS;
    }

    private static function string(Request $request, string $key, string $label): ?string
    {
        $value = $request->query($key);
        if ($value === '') {
            return null;
        }
        if ($value !== null && (! is_string($value) || strlen($value) > 512)) {
            throw new InvalidQuery("The {$label} filter is invalid.");
        }

        return $value;
    }
}
