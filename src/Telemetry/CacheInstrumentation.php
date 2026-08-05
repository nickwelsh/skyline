<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Cache\Events\CacheFlushed;
use Illuminate\Cache\Events\CacheFlushFailed;
use Illuminate\Cache\Events\CacheFlushing;
use Illuminate\Cache\Events\CacheHit;
use Illuminate\Cache\Events\CacheLocksFlushed;
use Illuminate\Cache\Events\CacheLocksFlushFailed;
use Illuminate\Cache\Events\CacheLocksFlushing;
use Illuminate\Cache\Events\CacheMissed;
use Illuminate\Cache\Events\ForgettingKey;
use Illuminate\Cache\Events\KeyForgetFailed;
use Illuminate\Cache\Events\KeyForgotten;
use Illuminate\Cache\Events\KeyWriteFailed;
use Illuminate\Cache\Events\KeyWritten;
use Illuminate\Cache\Events\RetrievingKey;
use Illuminate\Cache\Events\WritingKey;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Redis\Events\CommandExecuted;
use Illuminate\Redis\Events\CommandFailed;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use Psr\Log\LoggerInterface;
use Throwable;

final class CacheInstrumentation
{
    private bool $booted = false;

    /** @var list<array{run_id: string, attempt: int, operation: string, store: string, key: ?string, ttl: ?int, started_at: int, source: array<string, string|int>}> */
    private array $pending = [];

    public function __construct(
        private readonly Dispatcher $events,
        private readonly Container $container,
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
        private readonly PersistenceGuard $persistenceGuard,
        private readonly LoggerInterface $logger,
    ) {}

    public function boot(): void
    {
        if ($this->booted || ! (bool) $this->config->get('skyline.cache.enabled', true)) {
            return;
        }

        $this->booted = true;
        $this->listen(RetrievingKey::class, fn (RetrievingKey $event) => $this->begin('GET', $event->storeName, $event->key));
        $this->listen(WritingKey::class, fn (WritingKey $event) => $this->begin('PUT', $event->storeName, $event->key, $event->seconds));
        $this->listen(ForgettingKey::class, fn (ForgettingKey $event) => $this->begin('FORGET', $event->storeName, $event->key));
        $this->listen(CacheFlushing::class, fn (CacheFlushing $event) => $this->begin('FLUSH', $event->storeName));
        $this->listen(CacheLocksFlushing::class, fn (CacheLocksFlushing $event) => $this->begin('LOCK FLUSH', $event->storeName));

        $this->listen(CacheHit::class, fn (CacheHit $event) => $this->finish('GET', $event->storeName, $event->key, true, ['cache.hit' => true]));
        $this->listen(CacheMissed::class, fn (CacheMissed $event) => $this->finish('GET', $event->storeName, $event->key, true, ['cache.hit' => false]));
        $this->listen(KeyWritten::class, fn (KeyWritten $event) => $this->finish('PUT', $event->storeName, $event->key, true));
        $this->listen(KeyWriteFailed::class, fn (KeyWriteFailed $event) => $this->finish('PUT', $event->storeName, $event->key, false));
        $this->listen(KeyForgotten::class, fn (KeyForgotten $event) => $this->finish('FORGET', $event->storeName, $event->key, true));
        $this->listen(KeyForgetFailed::class, fn (KeyForgetFailed $event) => $this->finish('FORGET', $event->storeName, $event->key, false));
        $this->listen(CacheFlushed::class, fn (CacheFlushed $event) => $this->finish('FLUSH', $event->storeName, null, true));
        $this->listen(CacheFlushFailed::class, fn (CacheFlushFailed $event) => $this->finish('FLUSH', $event->storeName, null, false));
        $this->listen(CacheLocksFlushed::class, fn (CacheLocksFlushed $event) => $this->finish('LOCK FLUSH', $event->storeName, null, true));
        $this->listen(CacheLocksFlushFailed::class, fn (CacheLocksFlushFailed $event) => $this->finish('LOCK FLUSH', $event->storeName, null, false));

        if (class_exists(CommandExecuted::class)) {
            $this->listen(CommandExecuted::class, fn (CommandExecuted $event) => $this->redis($event, true));
            $this->listen(CommandFailed::class, fn (CommandFailed $event) => $this->redis($event, false));
        }

        if ($this->container->bound('redis')) {
            $redis = $this->container->make('redis');

            if (method_exists($redis, 'enableEvents')) {
                $redis->enableEvents();
            }
        }
    }

    private function begin(string $operation, ?string $store, ?string $key = null, mixed $ttl = null): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->persistenceGuard->active()) {
            return;
        }

        $this->pending[] = [
            'run_id' => $active->runId,
            'attempt' => $active->number,
            'operation' => $operation,
            'store' => $store ?? 'default',
            'key' => $key,
            'ttl' => is_numeric($ttl) ? (int) $ttl : null,
            'started_at' => $this->now(),
            'source' => (bool) $this->config->get('skyline.cache.capture_source', false)
                ? $this->source->attributes('skyline.cache.source')
                : [],
        ];
    }

    /** @param array<string, bool|int|string> $extra */
    private function finish(string $operation, ?string $store, ?string $key, bool $success, array $extra = []): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->persistenceGuard->active()) {
            return;
        }

        $index = $this->pendingIndex($active, $operation, $store ?? 'default', $key);

        if ($index === null) {
            return;
        }

        $this->endPending($index, $active, $success, $extra);
    }

    public function finishAttempt(ActiveAttempt $active): void
    {
        foreach (array_reverse(array_keys($this->pending)) as $index) {
            $pending = $this->pending[$index];

            if ($pending['run_id'] === $active->runId && $pending['attempt'] === $active->number) {
                $this->endPending($index, $active, false, ['cache.outcome' => 'incomplete']);
            }
        }
    }

    /** @param array<string, bool|int|string> $extra */
    private function endPending(int $index, ActiveAttempt $active, bool $success, array $extra): void
    {
        $pending = $this->pending[$index];
        array_splice($this->pending, $index, 1);

        $attributes = [
            'skyline.role' => 'cache',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'cache.operation' => $pending['operation'],
            'cache.store' => $pending['store'],
            ...$extra,
            ...$pending['source'],
        ];

        if ($pending['key'] !== null) {
            $attributes['cache.key'] = $this->key($pending['key']);
        }

        if ($pending['ttl'] !== null) {
            $attributes['cache.ttl'] = $pending['ttl'];
        }

        $end = $this->now();
        $span = $this->tracer->get()->spanBuilder('Cache '.$pending['operation'])
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp($pending['started_at'])
            ->setAttributes($attributes)
            ->startSpan();
        $span->setStatus($success ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
        $span->end($end);
    }

    private function redis(CommandExecuted|CommandFailed $event, bool $success): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->hasPending($active) || $this->persistenceGuard->active()) {
            return;
        }

        $end = $this->now();
        $duration = $event instanceof CommandExecuted && is_numeric($event->time)
            ? max(0, (int) round((float) $event->time * 1_000_000))
            : 0;
        $operation = strtoupper((string) $event->command);
        $span = $this->tracer->get()->spanBuilder('Redis '.$operation)
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp($end - $duration)
            ->setAttributes([
                'skyline.role' => 'redis',
                'skyline.run_id' => $active->runId,
                'skyline.attempt' => $active->number,
                'db.system.name' => 'redis',
                'db.operation.name' => $operation,
                'db.namespace' => $event->connectionName ?? 'default',
            ])
            ->startSpan();
        $span->setStatus($success ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
        $span->end($end);
    }

    private function pendingIndex(ActiveAttempt $active, string $operation, string $store, ?string $key): ?int
    {
        foreach ($this->pending as $index => $pending) {
            if ($pending['run_id'] === $active->runId
                && $pending['attempt'] === $active->number
                && $pending['operation'] === $operation
                && $pending['store'] === $store
                && $pending['key'] === $key) {
                return $index;
            }
        }

        return null;
    }

    private function hasPending(ActiveAttempt $active): bool
    {
        foreach ($this->pending as $pending) {
            if ($pending['run_id'] === $active->runId && $pending['attempt'] === $active->number) {
                return true;
            }
        }

        return false;
    }

    private function key(string $key): string
    {
        if ((bool) $this->config->get('skyline.cache.capture_keys', false)) {
            return mb_strcut($key, 0, max(16, (int) $this->config->get('skyline.cache.max_key_bytes', 256)), 'UTF-8');
        }

        return 'sha256:'.substr(hash('sha256', $key), 0, 16);
    }

    private function listen(string $event, callable $listener): void
    {
        $this->events->listen($event, function (object $value) use ($listener): void {
            try {
                $listener($value);
            } catch (Throwable $exception) {
                $this->report($exception);
            }
        });
    }

    private function report(Throwable $exception): void
    {
        try {
            $this->logger->warning('Skyline cache telemetry failed.', ['exception' => $exception]);
        } catch (Throwable) {
            // Monitoring failures cannot alter cache or Redis behavior.
        }
    }

    private function now(): int
    {
        return (int) round(microtime(true) * 1_000_000_000);
    }
}
