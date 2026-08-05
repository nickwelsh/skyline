<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Database\Events\TransactionCommitted;
use Illuminate\Database\Events\TransactionRolledBack;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Context\ContextInterface;
use Psr\Log\LoggerInterface;
use Throwable;

final class DatabaseTransactionInstrumentation
{
    private bool $booted = false;

    /** @var array<string, list<array{span: SpanInterface, context: ContextInterface, depth: int, query_time_ms: float}>> */
    private array $transactions = [];

    public function __construct(
        private readonly Dispatcher $events,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly PersistenceGuard $persistenceGuard,
        private readonly SkylineConnection $persistenceConnection,
        private readonly LoggerInterface $logger,
    ) {}

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $this->booted = true;
        $this->listen(TransactionBeginning::class, fn (TransactionBeginning $event) => $this->begin($event));
        $this->listen(TransactionCommitted::class, fn (TransactionCommitted $event) => $this->finish($event, 'committed'));
        $this->listen(TransactionRolledBack::class, fn (TransactionRolledBack $event) => $this->finish($event, 'rolled_back'));
    }

    public function context(string $connection): ?ContextInterface
    {
        $stack = $this->transactions[$connection] ?? [];

        return $stack === [] ? null : $stack[array_key_last($stack)]['context'];
    }

    public function recordQuery(string $connection, float $milliseconds): void
    {
        foreach ($this->transactions[$connection] ?? [] as $index => $transaction) {
            $this->transactions[$connection][$index]['query_time_ms'] = $transaction['query_time_ms'] + max(0, $milliseconds);
        }
    }

    private function begin(TransactionBeginning $event): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->ignored($event->connectionName)) {
            return;
        }

        $depth = max(1, (int) $event->connection->transactionLevel());
        $parent = $this->context($event->connectionName) ?? $active->context;
        $span = $this->tracer->get()->spanBuilder('Database transaction')
            ->setParent($parent)
            ->setSpanKind(SpanKind::KIND_INTERNAL)
            ->setAttributes([
                'skyline.role' => 'transaction',
                'skyline.run_id' => $active->runId,
                'skyline.attempt' => $active->number,
                'db.system.name' => $event->connection->getDriverName(),
                'db.namespace' => $event->connectionName,
                'db.transaction.depth' => $depth,
            ])
            ->startSpan();
        $this->transactions[$event->connectionName][] = [
            'span' => $span,
            'context' => $span->storeInContext($parent),
            'depth' => $depth,
            'query_time_ms' => 0.0,
        ];
    }

    private function finish(TransactionCommitted|TransactionRolledBack $event, string $outcome): void
    {
        if ($this->ignored($event->connectionName)) {
            return;
        }

        if (! isset($this->transactions[$event->connectionName])) {
            return;
        }

        $remainingDepth = max(0, (int) $event->connection->transactionLevel());
        $stack = &$this->transactions[$event->connectionName];

        while (($transaction = array_pop($stack)) !== null) {
            $span = $transaction['span'];
            $span->setAttribute('db.transaction.outcome', $outcome);
            $span->setAttribute('db.transaction.query_time_ms', $transaction['query_time_ms']);
            $span->setStatus($outcome === 'committed' ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
            $span->end();

            if ($transaction['depth'] === $remainingDepth + 1) {
                break;
            }
        }

        if ($stack === []) {
            unset($this->transactions[$event->connectionName]);
        }
    }

    private function ignored(string $connection): bool
    {
        return $this->persistenceGuard->active() || $this->persistenceConnection->owns($connection);
    }

    private function listen(string $event, callable $listener): void
    {
        $this->events->listen($event, function (object $value) use ($listener): void {
            try {
                $listener($value);
            } catch (Throwable $exception) {
                try {
                    $this->logger->warning('Skyline transaction telemetry failed.', ['exception' => $exception]);
                } catch (Throwable) {
                    // Monitoring failures cannot alter transaction behavior.
                }
            }
        });
    }
}
