<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class ErrorGroupsFilters
{
    private function __construct(
        public ?string $search,
        public ?string $jobType,
        public ?string $exceptionClass,
        public string $period,
        public ?int $from,
    ) {}

    public static function fromRequest(Request $request, int $observedAt, string $defaultPeriod): self
    {
        $search = self::string($request, 'search', 'Search');
        $jobType = self::string($request, 'jobType', 'Job type');
        $exceptionClass = self::string($request, 'exceptionClass', 'exception class');
        $time = JobsFilters::fromRequest($request, $observedAt, $defaultPeriod);

        return new self($search, $jobType, $exceptionClass, $time->period, $time->from);
    }

    public function apply(Builder $query): Builder
    {
        return $query
            ->when($this->search !== null, function (Builder $query): void {
                $search = strtolower($this->search);
                $query->where(function (Builder $query) use ($search): void {
                    PortableLike::whereContains($query, 'LOWER(skyline_attempts.exception_message)', $search);
                    $query->orWhere(fn (Builder $query): Builder => PortableLike::whereContains($query, 'LOWER(skyline_attempts.exception_class)', $search));
                    $query->orWhere(fn (Builder $query): Builder => PortableLike::whereContains($query, 'LOWER(skyline_attempts.exception_trace)', $search));
                    $query->orWhere(fn (Builder $query): Builder => PortableLike::whereContains($query, 'LOWER(skyline_attempts.run_id)', $search));
                });
            })
            ->when($this->jobType !== null, fn (Builder $query) => $query->where('skyline_runs.job_name', $this->jobType))
            ->when($this->exceptionClass !== null, fn (Builder $query) => $query->where('skyline_attempts.exception_class', $this->exceptionClass))
            ->when($this->from !== null, fn (Builder $query) => $query->where('skyline_attempts.started_at', '>=', $this->from));
    }

    /** @return array{search: ?string, jobType: ?string, exceptionClass: ?string, period: string} */
    public function toArray(): array
    {
        return ['search' => $this->search, 'jobType' => $this->jobType, 'exceptionClass' => $this->exceptionClass, 'period' => $this->period];
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
