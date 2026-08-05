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
use Illuminate\Cache\Events\RetrievingManyKeys;
use Illuminate\Cache\Events\WritingKey;
use Illuminate\Cache\Events\WritingManyKeys;
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

    /** @var list<array{run_id: string, attempt: int, operation: string, store: string, key: ?string, value: ?string, key_count: int, strategy: ?string, fresh_ttl: ?int, ttl: ?int, started_at: int, source: array<string, string|int>}> */
    private array $pending = [];

    public function __construct(
        private readonly Dispatcher $events,
        private readonly Container $container,
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
        private readonly ValueCapture $values,
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
        $this->listen(RetrievingManyKeys::class, fn (RetrievingManyKeys $event) => $this->beginMany('GET', $event->storeName, $event->keys));
        $this->listen(WritingKey::class, fn (WritingKey $event) => $this->begin('PUT', $event->storeName, $event->key, $event->seconds, value: $event->value));
        $this->listen(WritingManyKeys::class, fn (WritingManyKeys $event) => $this->beginMany('PUT', $event->storeName, $event->keys, $event->seconds, $event->values));
        $this->listen(ForgettingKey::class, fn (ForgettingKey $event) => $this->begin('FORGET', $event->storeName, $event->key));
        $this->listen(CacheFlushing::class, fn (CacheFlushing $event) => $this->begin('FLUSH', $event->storeName));
        $this->listen(CacheLocksFlushing::class, fn (CacheLocksFlushing $event) => $this->begin('LOCK FLUSH', $event->storeName));

        $this->listen(CacheHit::class, fn (CacheHit $event) => $this->finish('GET', $event->storeName, $event->key, true, ['cache.hit' => true], $event->value));
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

    private function begin(string $operation, ?string $store, ?string $key = null, mixed $ttl = null, ?string $strategy = null, int $keyCount = 1, ?int $freshTtl = null, mixed $value = null): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->persistenceGuard->active()) {
            return;
        }

        $context = $strategy === null ? $this->strategyContext() : null;
        $this->pending[] = [
            'run_id' => $active->runId,
            'attempt' => $active->number,
            'operation' => $operation,
            'store' => $store ?? 'default',
            'key' => $key,
            'value' => $operation === 'PUT' ? $this->value($value) : null,
            'key_count' => max(1, $keyCount),
            'strategy' => $strategy ?? $context['strategy'],
            'fresh_ttl' => $freshTtl ?? ($context['fresh_ttl'] ?? null),
            'ttl' => is_numeric($ttl) ? (int) $ttl : null,
            'started_at' => $this->now(),
            'source' => (bool) $this->config->get('skyline.cache.capture_source', false)
                ? $this->source->attributes('skyline.cache.source')
                : [],
        ];
    }

    /** @param array<array-key, mixed> $keys */
    private function beginMany(string $operation, ?string $store, array $keys, mixed $ttl = null, array $values = []): void
    {
        $keys = collect($keys)
            ->map(fn (mixed $value, int|string $key): mixed => is_string($key) ? $key : $value)
            ->filter(fn (mixed $key): bool => is_string($key))
            ->values()
            ->all();

        if ($keys === []) {
            return;
        }

        $context = $this->strategyContext();
        $strategy = $context['strategy'];

        if ($strategy === 'stale_while_revalidate' && $this->isFlexiblePair($keys)) {
            $this->begin($operation, $store, $keys[0], $ttl, $strategy, 1, $context['fresh_ttl']);

            return;
        }

        foreach ($keys as $index => $key) {
            $this->begin($operation, $store, $key, $ttl, $strategy ?? 'batch', count($keys), $context['fresh_ttl'], $values[$index] ?? null);
        }
    }

    /** @param array<string, bool|int|string> $extra */
    private function finish(string $operation, ?string $store, ?string $key, bool $success, array $extra = [], mixed $value = null): void
    {
        $active = $this->attempts->current();

        if ($active === null || $this->persistenceGuard->active()) {
            return;
        }

        $index = $this->pendingIndex($active, $operation, $store ?? 'default', $key);

        if ($index === null) {
            return;
        }

        $this->endPending($index, $active, $success, $extra, $value);
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
    private function endPending(int $index, ActiveAttempt $active, bool $success, array $extra, mixed $value = null): void
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
            $attributes['cache.key_captured'] = (bool) $this->config->get('skyline.cache.capture_keys', false);
        }

        $capturedValue = $pending['operation'] === 'GET' && ($extra['cache.hit'] ?? false)
            ? $this->value($value)
            : $pending['value'];

        if ($capturedValue !== null) {
            $attributes['cache.value'] = $capturedValue;
        }

        if ($pending['ttl'] !== null) {
            $attributes['cache.ttl'] = $pending['ttl'];
        } elseif ($pending['operation'] === 'PUT') {
            $attributes['cache.forever'] = true;
        }

        if ($pending['strategy'] !== null) {
            $attributes['cache.strategy'] = $pending['strategy'];
        }

        if ($pending['fresh_ttl'] !== null) {
            $attributes['cache.fresh_ttl'] = $pending['fresh_ttl'];
        }

        if ($pending['key_count'] > 1) {
            $attributes['cache.key_count'] = $pending['key_count'];
        }

        $attributes['cache.outcome'] = $this->outcome($pending['operation'], $success, $extra);

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
        $attributes = [
            'skyline.role' => 'redis',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'db.system.name' => 'redis',
            'db.operation.name' => $operation,
            'db.namespace' => $event->connectionName ?? 'default',
        ];

        if ((bool) $this->config->get('skyline.redis.capture_arguments', $this->config->get('skyline.capture_all', false))) {
            $attributes['db.operation.arguments'] = $this->values->encode(
                $event->parameters,
                (int) $this->config->get('skyline.redis.max_argument_bytes', 65_536),
            );
        }

        $span = $this->tracer->get()->spanBuilder('Redis '.$operation)
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp($end - $duration)
            ->setAttributes($attributes)
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

    /** @param list<string> $keys */
    private function isFlexiblePair(array $keys): bool
    {
        return count($keys) === 2 && $keys[1] === 'illuminate:cache:flexible:created:'.$keys[0];
    }

    /** @return array{strategy: ?string, fresh_ttl: ?int} */
    private function strategyContext(): array
    {
        $strategies = [
            'flexible' => 'stale_while_revalidate',
            'rememberForever' => 'remember_forever',
            'remember' => 'remember',
            'sear' => 'remember_forever',
            'pull' => 'pull',
            'add' => 'add_if_missing',
            'forever' => 'forever',
        ];

        foreach (debug_backtrace(0, 16) as $frame) {
            $function = $frame['function'] ?? null;

            if (is_string($function) && isset($strategies[$function])) {
                $freshTtl = null;

                if ($function === 'flexible' && is_array($frame['args'][1] ?? null) && is_numeric($frame['args'][1][0] ?? null)) {
                    $freshTtl = max(0, (int) $frame['args'][1][0]);
                }

                return ['strategy' => $strategies[$function], 'fresh_ttl' => $freshTtl];
            }
        }

        return ['strategy' => null, 'fresh_ttl' => null];
    }

    /** @param array<string, bool|int|string> $extra */
    private function outcome(string $operation, bool $success, array $extra): string
    {
        if (isset($extra['cache.outcome']) && is_string($extra['cache.outcome'])) {
            return $extra['cache.outcome'];
        }

        if (! $success) {
            return 'failed';
        }

        return match ($operation) {
            'GET' => ($extra['cache.hit'] ?? false) ? 'hit' : 'miss',
            'PUT' => 'stored',
            'FORGET' => 'deleted',
            'FLUSH', 'LOCK FLUSH' => 'flushed',
            default => 'completed',
        };
    }

    private function key(string $key): string
    {
        if ((bool) $this->config->get('skyline.cache.capture_keys', false)) {
            return mb_strcut($key, 0, max(16, (int) $this->config->get('skyline.cache.max_key_bytes', 256)), 'UTF-8');
        }

        return 'sha256:'.substr(hash('sha256', $key), 0, 16);
    }

    private function value(mixed $value): ?string
    {
        if (! (bool) $this->config->get('skyline.cache.capture_values', $this->config->get('skyline.capture_all', false))) {
            return null;
        }

        return $this->values->encode($value, (int) $this->config->get('skyline.cache.max_value_bytes', 65_536));
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
