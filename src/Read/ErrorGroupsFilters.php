<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class ErrorGroupsFilters
{
    private function __construct(
        public ?string $jobType,
        public ?string $exceptionClass,
        public string $period,
        public ?int $from,
    ) {}

    public static function fromRequest(Request $request, int $observedAt, string $defaultPeriod): self
    {
        $jobType = self::string($request, 'jobType', 'Job type');
        $exceptionClass = self::string($request, 'exceptionClass', 'exception class');
        $time = JobsFilters::fromRequest($request, $observedAt, $defaultPeriod);

        return new self($jobType, $exceptionClass, $time->period, $time->from);
    }

    public function apply(Builder $query): Builder
    {
        return $query
            ->when($this->jobType !== null, fn (Builder $query) => $query->where('skyline_runs.job_name', $this->jobType))
            ->when($this->exceptionClass !== null, fn (Builder $query) => $query->where('skyline_attempts.exception_class', $this->exceptionClass))
            ->when($this->from !== null, fn (Builder $query) => $query->where('skyline_attempts.started_at', '>=', $this->from));
    }

    /** @return array{jobType: ?string, exceptionClass: ?string, period: string} */
    public function toArray(): array
    {
        return ['jobType' => $this->jobType, 'exceptionClass' => $this->exceptionClass, 'period' => $this->period];
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
