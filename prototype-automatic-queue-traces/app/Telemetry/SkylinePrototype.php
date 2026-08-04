<?php

namespace App\Telemetry;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobReleasedAfterException;
use Illuminate\Queue\Queue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use OpenTelemetry\API\Trace\Propagation\TraceContextPropagator;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\API\Trace\TracerInterface;
use OpenTelemetry\Context\ScopeInterface;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use Throwable;

final class SkylinePrototype
{
    private readonly TracerInterface $tracer;

    private readonly TracerProvider $provider;

    private readonly BufferedSqlSpanExporter $exporter;

    private bool $enabled = true;

    /** @var array<string, array{span: SpanInterface, scope: ScopeInterface, run_id: string, exception: ?Throwable}> */
    private array $attempts = [];

    /** @var array<string, int> */
    private array $releasedAt = [];

    public function __construct(private readonly string $path)
    {
        $this->exporter = new BufferedSqlSpanExporter($path);
        $this->provider = new TracerProvider(new SimpleSpanProcessor($this->exporter));
        $this->tracer = $this->provider->getTracer('skyline.prototype', '0.1.0');
    }

    public function boot(): void
    {
        Queue::createPayloadUsing(
            fn (string $connection, ?string $queue, array $payload) => $this->payload($connection, $queue, $payload),
        );

        Event::listen(JobProcessing::class, fn (JobProcessing $event) => $this->guard(fn () => $this->processing($event)));
        Event::listen(JobProcessed::class, fn (JobProcessed $event) => $this->guard(fn () => $this->finish($event->job, 'success')));
        Event::listen(JobExceptionOccurred::class, fn (JobExceptionOccurred $event) => $this->guard(fn () => $this->exception($event)));
        Event::listen(JobReleasedAfterException::class, fn (JobReleasedAfterException $event) => $this->guard(fn () => $this->finish($event->job, 'retry')));
        Event::listen(JobFailed::class, fn (JobFailed $event) => $this->guard(fn () => $this->finish($event->job, 'failure', $event->exception)));
        DB::listen(fn (QueryExecuted $query) => $this->guard(fn () => $this->query($query)));
    }

    public function reset(): void
    {
        $this->exporter->reset();
        $this->attempts = [];
        $this->releasedAt = [];
    }

    public function enable(): void
    {
        $this->enabled = true;
    }

    public function disable(): void
    {
        $this->enabled = false;
    }

    /** @return list<array<string, mixed>> */
    public function spans(): array
    {
        $this->provider->forceFlush();

        return $this->exporter->spans();
    }

    /** @return array<string, mixed> */
    private function payload(string $connection, ?string $queue, array $payload): array
    {
        if (! $this->enabled) {
            return [];
        }

        try {
            $parent = end($this->attempts) ?: null;
            $runId = (string) Str::ulid();
            $job = $payload['displayName'] ?? $payload['job'] ?? 'unknown';
            $queuedAt = $this->now();
            $span = $this->tracer->spanBuilder($job.' dispatch')
                ->setSpanKind(SpanKind::KIND_PRODUCER)
                ->setAttributes([
                    'skyline.role' => 'producer',
                    'skyline.run_id' => $runId,
                    'skyline.parent_run_id' => $parent['run_id'] ?? '',
                    'messaging.system' => 'laravel',
                    'messaging.destination.name' => $queue ?? 'default',
                    'messaging.operation.name' => 'publish',
                    'laravel.queue.connection' => $connection,
                    'laravel.job.name' => $job,
                ])
                ->startSpan();

            $scope = $span->activate();
            $carrier = [];
            TraceContextPropagator::getInstance()->inject($carrier);
            $scope->detach();
            $span->end();

            return ['skyline' => [
                'v' => 1,
                'run_id' => $runId,
                'parent_run_id' => $parent['run_id'] ?? null,
                'queued_at_ns' => $queuedAt,
                'carrier' => $carrier,
            ]];
        } catch (Throwable) {
            return [];
        }
    }

    private function processing(JobProcessing $event): void
    {
        if (! $this->enabled) {
            return;
        }

        $envelope = $event->job->payload()['skyline'] ?? null;

        if (! is_array($envelope) || ($envelope['v'] ?? null) !== 1) {
            return;
        }

        $runId = $envelope['run_id'];
        $attempt = $event->job->attempts();
        $readyAt = $this->releasedAt[$runId] ?? $envelope['queued_at_ns'];
        $parent = TraceContextPropagator::getInstance()->extract($envelope['carrier'] ?? []);
        $span = $this->tracer->spanBuilder($event->job->resolveName().' attempt '.$attempt)
            ->setParent($parent)
            ->setSpanKind(SpanKind::KIND_CONSUMER)
            ->setAttributes([
                'skyline.role' => 'consumer',
                'skyline.run_id' => $runId,
                'skyline.parent_run_id' => $envelope['parent_run_id'] ?? '',
                'skyline.attempt' => $attempt,
                'skyline.queue_time_ms' => ($this->now() - $readyAt) / 1_000_000,
                'messaging.system' => 'laravel',
                'messaging.operation.name' => 'process',
                'laravel.queue.connection' => $event->connectionName,
                'laravel.job.name' => $event->job->resolveName(),
            ])
            ->startSpan();

        $span->addEvent('attempt.started');
        $this->attempts[$this->key($event->job)] = [
            'span' => $span,
            'scope' => $span->activate(),
            'run_id' => $runId,
            'exception' => null,
        ];
    }

    private function exception(JobExceptionOccurred $event): void
    {
        $key = $this->key($event->job);

        if (! isset($this->attempts[$key])) {
            return;
        }

        $this->attempts[$key]['exception'] = $event->exception;
        $this->attempts[$key]['span']->recordException($event->exception);
        $this->attempts[$key]['span']->setStatus(StatusCode::STATUS_ERROR, $event->exception->getMessage());
    }

    private function finish(object $job, string $outcome, ?Throwable $exception = null): void
    {
        $key = $this->key($job);
        $attempt = $this->attempts[$key] ?? null;

        if ($attempt === null) {
            return;
        }

        $exception ??= $attempt['exception'];

        if ($exception !== null && $attempt['exception'] === null) {
            $attempt['span']->recordException($exception);
            $attempt['span']->setStatus(StatusCode::STATUS_ERROR, $exception->getMessage());
        }

        if ($outcome === 'success') {
            $attempt['span']->setStatus(StatusCode::STATUS_OK);
        }

        $attempt['span']->setAttribute('skyline.outcome', $outcome);
        $attempt['span']->addEvent('attempt.finished', ['skyline.outcome' => $outcome]);
        $attempt['scope']->detach();
        $attempt['span']->end();
        unset($this->attempts[$key]);
        $this->provider->forceFlush();

        if ($outcome === 'retry') {
            $this->releasedAt[$attempt['run_id']] = $this->now();
        }
    }

    private function query(QueryExecuted $query): void
    {
        if (! $this->enabled || $this->attempts === []) {
            return;
        }

        $end = $this->now();
        $span = $this->tracer->spanBuilder('SQL '.strtoupper(strtok(ltrim($query->sql), ' ')))
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp($end - (int) round($query->time * 1_000_000))
            ->setAttributes([
                'skyline.role' => 'sql',
                'db.system.name' => $query->connection->getDriverName(),
                'db.namespace' => $query->connectionName,
                'db.query.text' => $query->sql,
                'db.operation.name' => strtoupper(strtok(ltrim($query->sql), ' ')),
            ])
            ->startSpan();
        $span->setStatus(StatusCode::STATUS_OK);
        $span->end($end);
    }

    private function key(object $job): string
    {
        return $job->uuid() ?? (string) $job->getJobId();
    }

    private function now(): int
    {
        return (int) round(microtime(true) * 1_000_000_000);
    }

    private function guard(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (Throwable) {
            return null;
        }
    }
}
