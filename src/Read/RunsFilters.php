<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final readonly class RunsFilters
{
    private const STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'];

    /** @param list<string> $statuses */
    private function __construct(
        public array $statuses,
        public ?string $job,
        public ?string $connection,
        public ?string $queue,
        public ?int $triggeredFrom,
        public ?int $triggeredTo,
        public ?string $search,
    ) {}

    public static function fromRequest(Request $request): self
    {
        $status = $request->query('status', []);
        $statuses = is_string($status) ? explode(',', $status) : $status;

        if (! is_array($statuses) || array_filter($statuses, fn ($value): bool => ! is_string($value)) !== []) {
            throw new InvalidQuery('The status filter is invalid.');
        }

        $statuses = array_values(array_unique(array_filter($statuses, fn (string $value): bool => $value !== '')));

        if (array_diff($statuses, self::STATUSES) !== []) {
            throw new InvalidQuery('The status filter is invalid.');
        }

        $job = self::optionalString($request, 'job', 255);
        $connection = self::optionalString($request, 'connection', 255);
        $queue = self::optionalString($request, 'queue', 255);

        if (($connection === null) !== ($queue === null)) {
            throw new InvalidQuery('Connection and queue must be filtered together.');
        }

        $from = self::optionalTime($request, 'triggeredFrom');
        $to = self::optionalTime($request, 'triggeredTo');

        if ($from !== null && $to !== null && $from > $to) {
            throw new InvalidQuery('The triggered time range is invalid.');
        }

        return new self(
            $statuses,
            $job,
            $connection,
            $queue,
            $from,
            $to,
            self::optionalString($request, 'search', 512),
        );
    }

    public function apply(Builder $query, bool $includeStatus = true): Builder
    {
        return $query
            ->when($includeStatus && $this->statuses !== [], fn (Builder $query) => $query->whereIn('skyline_runs.status', $this->statuses))
            ->when($this->job !== null, fn (Builder $query) => $query->where('skyline_runs.job_name', $this->job))
            ->when($this->connection !== null, fn (Builder $query) => $query
                ->where('skyline_runs.connection', $this->connection)
                ->where('skyline_runs.queue', $this->queue))
            ->when($this->triggeredFrom !== null, fn (Builder $query) => $query->where('skyline_runs.triggered_at', '>=', $this->triggeredFrom))
            ->when($this->triggeredTo !== null, fn (Builder $query) => $query->where('skyline_runs.triggered_at', '<=', $this->triggeredTo))
            ->when($this->search !== null, function (Builder $query): void {
                $search = addcslashes($this->search, '%_');
                $query->where(function (Builder $query) use ($search): void {
                    $query->whereRaw('LOWER(skyline_runs.job_name) LIKE ?', ['%'.strtolower($search).'%'])
                        ->orWhere('skyline_runs.run_id', $this->search)
                        ->orWhere('skyline_runs.run_id', 'like', $search.'%');
                });
            });
    }

    /** @return array{status: list<string>, job: ?string, connection: ?string, queue: ?string, triggeredFrom: ?string, triggeredTo: ?string, search: ?string} */
    public function toArray(): array
    {
        return [
            'status' => $this->statuses,
            'job' => $this->job,
            'connection' => $this->connection,
            'queue' => $this->queue,
            'triggeredFrom' => Nanoseconds::toRfc3339($this->triggeredFrom),
            'triggeredTo' => Nanoseconds::toRfc3339($this->triggeredTo),
            'search' => $this->search,
        ];
    }

    /** @return array<string, mixed> */
    public function toQuery(): array
    {
        return array_filter([
            'status' => $this->statuses,
            'job' => $this->job,
            'connection' => $this->connection,
            'queue' => $this->queue,
            'triggeredFrom' => Nanoseconds::toRfc3339($this->triggeredFrom),
            'triggeredTo' => Nanoseconds::toRfc3339($this->triggeredTo),
            'search' => $this->search,
        ], fn (mixed $value): bool => $value !== null && $value !== []);
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
