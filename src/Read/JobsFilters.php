<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class JobsFilters
{
    /** @var array<string, int|null> */
    private const PERIODS = [
        '1h' => 3_600_000_000_000,
        '24h' => 86_400_000_000_000,
        '7d' => 604_800_000_000_000,
        '30d' => 2_592_000_000_000_000,
        'all' => null,
    ];

    private function __construct(
        public ?string $search,
        public string $period,
        public ?int $from,
    ) {}

    public static function fromRequest(Request $request, int $observedAt): self
    {
        $search = $request->query('search');
        if ($search === '') {
            $search = null;
        }
        if ($search !== null && (! is_string($search) || strlen($search) > 512)) {
            throw new InvalidQuery('The search filter is invalid.');
        }

        $period = $request->query('period', 'all');
        if (! is_string($period) || ! array_key_exists($period, self::PERIODS)) {
            throw new InvalidQuery('The time range filter is invalid.');
        }
        $duration = self::PERIODS[$period];

        return new self($search, $period, $duration === null ? null : $observedAt - $duration);
    }

    public function apply(Builder $query, string $table = 'skyline_runs'): Builder
    {
        return $query
            ->when($this->from !== null, fn (Builder $query) => $query->where("{$table}.triggered_at", '>=', $this->from))
            ->when($this->search !== null, function (Builder $query) use ($table): void {
                $search = addcslashes(strtolower($this->search), '%_');
                $query->whereRaw("LOWER({$table}.job_name) LIKE ?", ['%'.$search.'%']);
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
        return [
            ['value' => '1h', 'label' => 'Last hour'],
            ['value' => '24h', 'label' => 'Last 24 hours'],
            ['value' => '7d', 'label' => 'Last 7 days'],
            ['value' => '30d', 'label' => 'Last 30 days'],
            ['value' => 'all', 'label' => 'All time'],
        ];
    }
}
