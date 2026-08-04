<?php

namespace App\Telemetry;

use OpenTelemetry\SDK\Common\Future\CancellationInterface;
use OpenTelemetry\SDK\Common\Future\CompletedFuture;
use OpenTelemetry\SDK\Common\Future\FutureInterface;
use OpenTelemetry\SDK\Trace\SpanDataInterface;
use OpenTelemetry\SDK\Trace\SpanExporterInterface;
use PDO;
use Throwable;

final class BufferedSqlSpanExporter implements SpanExporterInterface
{
    /** @var list<array<string, mixed>> */
    private array $pending = [];

    private readonly PDO $database;

    public function __construct(string $path)
    {
        $this->database = new PDO('sqlite:'.$path);
        $this->database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->database->exec('PRAGMA journal_mode = WAL');
        $this->database->exec('PRAGMA synchronous = NORMAL');
        $this->database->exec('CREATE TABLE IF NOT EXISTS spans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trace_id TEXT NOT NULL,
            span_id TEXT NOT NULL,
            parent_span_id TEXT NOT NULL,
            payload TEXT NOT NULL
        )');
    }

    public function export(iterable $batch, ?CancellationInterface $cancellation = null): FutureInterface
    {
        foreach ($batch as $span) {
            $this->pending[] = $this->serialize($span);
        }

        return new CompletedFuture(true);
    }

    public function shutdown(?CancellationInterface $cancellation = null): bool
    {
        return $this->forceFlush($cancellation);
    }

    public function forceFlush(?CancellationInterface $cancellation = null): bool
    {
        if ($this->pending === []) {
            return true;
        }

        try {
            $this->database->beginTransaction();
            $statement = $this->database->prepare(
                'INSERT INTO spans (trace_id, span_id, parent_span_id, payload) VALUES (?, ?, ?, ?)',
            );

            foreach ($this->pending as $span) {
                $statement->execute([
                    $span['trace_id'],
                    $span['span_id'],
                    $span['parent_span_id'],
                    json_encode($span, JSON_THROW_ON_ERROR),
                ]);
            }

            $this->database->commit();
            $this->pending = [];

            return true;
        } catch (Throwable) {
            if ($this->database->inTransaction()) {
                $this->database->rollBack();
            }

            $this->pending = [];

            return false;
        }
    }

    public function reset(): void
    {
        $this->pending = [];
        $this->database->exec('DELETE FROM spans');
    }

    /** @return list<array<string, mixed>> */
    public function spans(): array
    {
        $rows = $this->database->query('SELECT payload FROM spans ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);

        return array_map(static fn (string $payload) => json_decode($payload, true, flags: JSON_THROW_ON_ERROR), $rows);
    }

    /** @return array<string, mixed> */
    private function serialize(SpanDataInterface $span): array
    {
        return [
            'name' => $span->getName(),
            'trace_id' => $span->getTraceId(),
            'span_id' => $span->getSpanId(),
            'parent_span_id' => $span->getParentSpanId(),
            'kind' => $span->getKind(),
            'status' => $span->getStatus()->getCode(),
            'status_description' => $span->getStatus()->getDescription(),
            'start_ns' => $span->getStartEpochNanos(),
            'end_ns' => $span->getEndEpochNanos(),
            'attributes' => $span->getAttributes()->toArray(),
            'events' => array_map(static fn ($event) => [
                'name' => $event->getName(),
                'timestamp_ns' => $event->getEpochNanos(),
                'attributes' => $event->getAttributes()->toArray(),
            ], $span->getEvents()),
        ];
    }
}
