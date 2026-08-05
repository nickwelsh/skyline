<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Http\Request;

final readonly class QueueTargetFilters
{
    private const TIME_RANGES = [
        ['value' => 'all', 'label' => 'All time'],
        ['value' => '1h', 'label' => 'Last hour'],
        ['value' => '24h', 'label' => 'Last 24 hours'],
        ['value' => '7d', 'label' => 'Last 7 days'],
    ];

    /** @param list<string> $statuses */
    private function __construct(
        public ?string $connection,
        public ?string $search,
        public ?int $from,
        public ?int $to,
        public array $statuses,
    ) {}

    public static function fromRequest(Request $request, bool $detail = false): self
    {
        $connection = self::optionalString($request, 'connection', 255);
        $search = self::optionalString($request, 'search', 512);
        $from = self::optionalTime($request, 'from');
        $to = self::optionalTime($request, 'to');

        if ($from !== null && $to !== null && $from > $to) {
            throw new InvalidQuery('The Queue-target time range is invalid.');
        }

        $status = $request->query('status', []);
        $statuses = is_string($status) ? explode(',', $status) : $status;
        if (! is_array($statuses) || array_filter($statuses, fn (mixed $value): bool => ! is_string($value)) !== []) {
            throw new InvalidQuery('The status filter is invalid.');
        }

        $statuses = array_values(array_unique(array_filter($statuses, fn (string $value): bool => $value !== '')));
        if (array_diff($statuses, ['queued', 'running', 'retrying', 'completed', 'failed']) !== []) {
            throw new InvalidQuery('The status filter is invalid.');
        }
        if (! $detail && $statuses !== []) {
            throw new InvalidQuery('The status filter is invalid.');
        }

        return new self($connection, $search, $from, $to, $statuses);
    }

    /** @return array{connection: ?string, search: ?string, from: ?string, to: ?string, status: list<string>} */
    public function toArray(): array
    {
        return [
            'connection' => $this->connection,
            'search' => $this->search,
            'from' => Nanoseconds::toRfc3339($this->from),
            'to' => Nanoseconds::toRfc3339($this->to),
            'status' => $this->statuses,
        ];
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return self::TIME_RANGES;
    }

    private static function optionalString(Request $request, string $key, int $max): ?string
    {
        $value = $request->query($key);
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value) || strlen($value) > $max) {
            throw new InvalidQuery("The {$key} filter is invalid.");
        }

        return $value;
    }

    private static function optionalTime(Request $request, string $key): ?int
    {
        $value = self::optionalString($request, $key, 64);
        if ($value === null) {
            return null;
        }

        $timestamp = Nanoseconds::fromRfc3339($value);
        if ($timestamp === null) {
            throw new InvalidQuery("The {$key} filter is invalid.");
        }

        return $timestamp;
    }
}
