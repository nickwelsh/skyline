<?php

namespace NickWelsh\Skyline\Read;

final readonly class QueueTargetIdentity
{
    public function __construct(
        public string $connection,
        public string $queue,
    ) {}

    public static function fromRow(object $row): self
    {
        return new self($row->connection, $row->queue);
    }

    /** @param array<string, mixed> $cursor */
    public static function fromCursor(array $cursor): ?self
    {
        $connection = $cursor['connection'] ?? null;
        $queue = $cursor['queue'] ?? null;

        return is_string($connection) && is_string($queue) ? new self($connection, $queue) : null;
    }

    public function id(): string
    {
        return ObservedIds::queue($this->connection, $this->queue);
    }

    public function groupKey(): string
    {
        return $this->id();
    }

    public function compare(self $other): int
    {
        return [$this->connection, $this->queue] <=> [$other->connection, $other->queue];
    }

    /** @return array{connection: string, queue: string} */
    public function cursor(): array
    {
        return ['connection' => $this->connection, 'queue' => $this->queue];
    }
}
