<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class JobsFilters
{
    /** @var array<string, array{duration: int|null, label: string}> */
    private const PERIODS = [
        '1h' => ['duration' => 3_600_000_000_000, 'label' => 'Last hour'],
        '24h' => ['duration' => 86_400_000_000_000, 'label' => 'Last 24 hours'],
        '7d' => ['duration' => 604_800_000_000_000, 'label' => 'Last 7 days'],
        '30d' => ['duration' => 2_592_000_000_000_000, 'label' => 'Last 30 days'],
        'all' => ['duration' => null, 'label' => 'All time'],
    ];

    private function __construct(
        public ?string $search,
        public string $period,
        public ?int $from,
    ) {}

    public static function fromRequest(Request $request, int $observedAt, string $defaultPeriod = 'all'): self
    {
        $search = $request->query('search');
        if ($search === '') {
            $search = null;
        }
        if ($search !== null && (! is_string($search) || strlen($search) > 512)) {
            throw new InvalidQuery('The search filter is invalid.');
        }

        $period = $request->query('period', $defaultPeriod);
        if (! is_string($period) || ! array_key_exists($period, self::PERIODS)) {
            throw new InvalidQuery('The time range filter is invalid.');
        }
        $duration = self::PERIODS[$period]['duration'];

        return new self($search, $period, $duration === null ? null : $observedAt - $duration);
    }

    public function apply(Builder $query, string $table = 'skyline_runs'): Builder
    {
        return $query
            ->when($this->from !== null, fn (Builder $query) => $query->where("{$table}.triggered_at", '>=', $this->from))
            ->when($this->search !== null, function (Builder $query) use ($table): void {
                PortableLike::whereContains($query, "LOWER({$table}.job_name)", strtolower($this->search));
            });
    }

    /** @return array{search: ?string, period: string} */
    public function toArray(): array
    {
        return ['search' => $this->search, 'period' => $this->period];
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return collect(self::PERIODS)
            ->map(fn (array $definition, string $value): array => ['value' => $value, 'label' => $definition['label']])
            ->values()->all();
    }
}
