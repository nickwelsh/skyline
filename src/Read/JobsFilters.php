<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class JobsFilters
{
    private const DEFAULT_DETAIL_DURATION = 604_800_000_000_000;

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
        public ?string $period,
        public ?int $from,
        public ?int $to,
        public ?string $fromValue,
        public ?string $toValue,
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

        $fromValue = $request->query('from');
        $toValue = $request->query('to');
        if ($fromValue !== null || $toValue !== null) {
            $from = self::milliseconds($fromValue, 'from');
            $to = self::milliseconds($toValue, 'to');
            $effectiveTo = $to ?? $observedAt;
            $effectiveFrom = $from ?? $effectiveTo - self::DEFAULT_DETAIL_DURATION;
            if ($effectiveFrom >= $effectiveTo) {
                throw new InvalidQuery('The time range filter is invalid.');
            }

            return new self(
                $search,
                null,
                $effectiveFrom,
                $effectiveTo,
                $fromValue === null ? null : (string) $fromValue,
                $toValue === null ? null : (string) $toValue,
            );
        }

        $period = $request->query('period', $defaultPeriod);
        if (! is_string($period)) {
            throw new InvalidQuery('The time range filter is invalid.');
        }
        $duration = self::duration($period);
        if ($duration === false) {
            throw new InvalidQuery('The time range filter is invalid.');
        }

        return new self(
            $search,
            $period,
            $duration === null ? null : $observedAt - $duration,
            $duration === null ? null : $observedAt,
            null,
            null,
        );
    }

    public function apply(Builder $query, string $table = 'skyline_runs'): Builder
    {
        return $query
            ->when($this->from !== null, fn (Builder $query) => $query->where("{$table}.triggered_at", '>=', $this->from))
            ->when($this->to !== null, fn (Builder $query) => $query->where("{$table}.triggered_at", '<=', $this->to))
            ->when($this->search !== null, function (Builder $query) use ($table): void {
                PortableLike::whereContains($query, "LOWER({$table}.job_name)", strtolower($this->search));
            });
    }

    /** @return array{search: ?string, period: ?string, from: ?string, to: ?string} */
    public function toArray(): array
    {
        return [
            'search' => $this->search,
            'period' => $this->period,
            'from' => $this->fromValue,
            'to' => $this->toValue,
        ];
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return collect(self::PERIODS)
            ->map(fn (array $definition, string $value): array => ['value' => $value, 'label' => $definition['label']])
            ->values()->all();
    }

    private static function duration(string $period): int|false|null
    {
        if (array_key_exists($period, self::PERIODS)) {
            return self::PERIODS[$period]['duration'];
        }
        if (! preg_match('/^([1-9][0-9]{0,5})([mhd])$/', $period, $matches)) {
            return false;
        }

        $unit = match ($matches[2]) {
            'm' => 60_000_000_000,
            'h' => 3_600_000_000_000,
            'd' => 86_400_000_000_000,
        };
        $amount = (int) $matches[1];
        if ($amount > intdiv(PHP_INT_MAX, $unit)) {
            return false;
        }

        return $amount * $unit;
    }

    private static function milliseconds(mixed $value, string $name): ?int
    {
        if ($value === null) {
            return null;
        }
        if (! is_string($value) && ! is_int($value)) {
            throw new InvalidQuery("The {$name} time filter is invalid.");
        }
        $value = (string) $value;
        if (! preg_match('/^[1-9][0-9]{0,15}$/', $value)) {
            throw new InvalidQuery("The {$name} time filter is invalid.");
        }

        $milliseconds = (int) $value;
        if ($milliseconds > intdiv(PHP_INT_MAX, 1_000_000)) {
            throw new InvalidQuery("The {$name} time filter is invalid.");
        }

        return $milliseconds * 1_000_000;
    }
}
