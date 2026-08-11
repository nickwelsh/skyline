<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class TelemetryEventsFilters
{
    private const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

    /** @param list<string> $levels */
    private function __construct(
        public ?string $search,
        public array $levels,
        public ?string $jobType,
        public ?string $runId,
        public ?string $period,
        public ?int $from,
        public ?int $to,
        public ?string $fromValue,
        public ?string $toValue,
    ) {}

    public static function fromRequest(Request $request, int $observedAt): self
    {
        $time = JobsFilters::fromRequest($request, $observedAt, '1h');
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

        return new self(
            $time->search,
            $levels,
            $jobType,
            $runId,
            $time->period,
            $time->from,
            $time->to,
            $time->fromValue,
            $time->toValue,
        );
    }

    public function applyQuery(Builder $events): Builder
    {
        return $events
            ->when($this->search !== null, function (Builder $events): void {
                $search = strtolower($this->search);
                $events->where(function (Builder $events) use ($search): void {
                    PortableLike::whereContains($events, 'LOWER(skyline_telemetry_events.message)', $search);
                    $events->orWhere(fn (Builder $events): Builder => PortableLike::whereContains($events, 'LOWER(skyline_telemetry_events.name)', $search));
                    $events->orWhere(fn (Builder $events): Builder => PortableLike::whereContains($events, 'LOWER(skyline_telemetry_events.run_id)', $search));
                    $events->orWhere(fn (Builder $events): Builder => PortableLike::whereContains($events, 'LOWER(skyline_runs.job_name)', $search));
                });
            })
            ->when($this->levels !== [], fn (Builder $events): Builder => $events->whereIn('skyline_telemetry_events.level', $this->levels))
            ->when($this->jobType !== null, fn (Builder $events): Builder => $events->where('skyline_runs.job_name', $this->jobType))
            ->when($this->runId !== null, fn (Builder $events): Builder => $events->where('skyline_telemetry_events.run_id', $this->runId))
            ->when($this->from !== null, fn (Builder $events): Builder => $events->where('skyline_telemetry_events.occurred_at', '>=', $this->from))
            ->when($this->to !== null, fn (Builder $events): Builder => $events->where('skyline_telemetry_events.occurred_at', '<=', $this->to));
    }

    /** @return array{search: ?string, levels: list<string>, jobType: ?string, runId: ?string, period: ?string, from: ?string, to: ?string} */
    public function toArray(): array
    {
        return [
            'search' => $this->search,
            'levels' => $this->levels,
            'jobType' => $this->jobType,
            'runId' => $this->runId,
            'period' => $this->period,
            'from' => $this->fromValue,
            'to' => $this->toValue,
        ];
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
