<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Queue\Events\JobAttempted;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobQueued;
use Illuminate\Queue\Events\JobReleasedAfterException;
use Illuminate\Queue\Events\JobTimedOut;
use Illuminate\Queue\Queue;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use OpenTelemetry\API\Trace\Propagation\TraceContextPropagator;
use OpenTelemetry\API\Trace\Span;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Context\Context;
use Psr\Log\LoggerInterface;
use Throwable;

final class QueueInstrumentation
{
    private bool $booted = false;

    private bool $handling = false;

    private bool $enabled = true;

    public function __construct(
        private readonly Dispatcher $events,
        private readonly AttemptRegistry $attempts,
        private readonly LifecycleEmitter $lifecycle,
        private readonly SkylineTracer $tracer,
        private readonly LoggerInterface $logger,
        private readonly PersistenceGuard $persistenceGuard,
        private readonly SkylineConnection $persistenceConnection,
        private readonly SqlCapture $sqlCapture,
        private readonly OutgoingHttpInstrumentation $http,
        private readonly CacheInstrumentation $cache,
    ) {}

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $this->booted = true;
        $this->sqlCapture->boot();
        $this->http->boot();
        $this->cache->boot();

        Queue::createPayloadUsing(
            fn (string $connection, ?string $queue, array $payload): array => $this->guard(
                fn (): array => $this->payload($connection, $queue, $payload),
                [],
            ),
        );

        $this->listen(JobQueued::class, fn (JobQueued $event) => $this->queued($event));
        $this->listen(JobProcessing::class, fn (JobProcessing $event) => $this->processing($event));
        $this->listen(JobProcessed::class, fn (JobProcessed $event) => $this->processed($event->job));
        $this->listen(JobExceptionOccurred::class, fn (JobExceptionOccurred $event) => $this->exception($event));
        $this->listen(JobReleasedAfterException::class, fn (JobReleasedAfterException $event) => $this->releasedAfterException($event));
        $this->listen(JobFailed::class, fn (JobFailed $event) => $this->failed($event));
        $this->listen(JobTimedOut::class, fn (JobTimedOut $event) => $this->timedOut($event->job));
        $this->listen(JobAttempted::class, fn (JobAttempted $event) => $this->attempted($event));

        $this->listen(QueryExecuted::class, fn (QueryExecuted $query) => $this->query($query));
    }

    public function enable(): void
    {
        $this->enabled = true;
    }

    public function disable(): void
    {
        $this->enabled = false;
    }

    /** @return array{skyline: array{v: 1, run_id: string, parent_run_id: ?string, queued_at_ns: int, carrier: array<string, string>}}|array{} */
    private function payload(string $connection, ?string $queue, array $payload): array
    {
        $runId = $payload['uuid'] ?? null;

        if (! is_string($runId) || $runId === '') {
            return [];
        }

        $job = $this->jobName($payload);
        $parent = $this->attempts->current();
        $queuedAt = $this->now();
        $builder = $this->tracer->get()->spanBuilder($job.' dispatch')
            ->setParent($parent?->context ?? false)
            ->setSpanKind(SpanKind::KIND_PRODUCER)
            ->setAttributes([
                'skyline.role' => 'producer',
                'skyline.run_id' => $runId,
                'skyline.parent_run_id' => $parent?->runId ?? '',
                'messaging.system' => 'laravel',
                'messaging.destination.name' => $queue ?? 'default',
                'messaging.operation.name' => 'publish',
                'messaging.message.id' => $runId,
                'laravel.queue.connection' => $connection,
                'laravel.job.name' => $job,
            ]);

        if ($parent === null) {
            $host = Span::getCurrent()->getContext();

            if ($host->isValid()) {
                $builder->addLink($host);
            }
        }

        $span = $builder->startSpan();
        $context = $span->storeInContext(Context::getRoot());
        $carrier = [];
        TraceContextPropagator::getInstance()->inject($carrier, context: $context);

        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::RunDispatched,
            $runId,
            null,
            $queuedAt,
            [
                'trace_id' => $span->getContext()->getTraceId(),
                'parent_run_id' => $parent?->runId,
                'job_name' => $job,
                'connection' => $connection,
                'queue' => $queue ?? 'default',
            ],
        ));
        $span->setStatus(StatusCode::STATUS_OK);
        $span->end();

        return ['skyline' => (new PayloadEnvelope(
            $runId,
            $parent?->runId,
            $queuedAt,
            $carrier,
        ))->toArray()];
    }

    private function queued(JobQueued $event): void
    {
        $envelope = PayloadEnvelope::fromPayload($event->payload());

        if ($envelope === null) {
            return;
        }

        $timestamp = $this->now();
        $this->attempts->rememberReadyAt($envelope->runId, $timestamp, 'queued');
        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::RunQueued,
            $envelope->runId,
            null,
            $timestamp,
            [
                'trace_id' => $this->traceId($envelope),
                'connection' => $event->connectionName,
                'queue' => $event->queue ?? 'default',
                'driver_id' => $event->id === null ? null : (string) $event->id,
                'delay' => is_numeric($event->delay) ? (int) $event->delay : null,
                'queue_time_source' => 'exact',
            ],
        ));
    }

    private function processing(JobProcessing $event): void
    {
        $envelope = PayloadEnvelope::fromPayload($event->job->payload());

        if ($envelope === null) {
            return;
        }

        $attempt = (int) $event->job->attempts();
        if ($this->attempts->has($envelope->runId, $attempt)) {
            return;
        }

        $now = $this->now();
        $ready = $this->attempts->queueStart($event->connectionName, $envelope, $now);
        $parent = TraceContextPropagator::getInstance()->extract(
            $envelope->carrier,
            context: Context::getRoot(),
        );
        $job = $event->job->resolveName();
        $span = $this->tracer->get()->spanBuilder($job.' attempt '.$attempt)
            ->setParent($parent)
            ->setSpanKind(SpanKind::KIND_CONSUMER)
            ->setAttributes([
                'skyline.role' => 'consumer',
                'skyline.run_id' => $envelope->runId,
                'skyline.parent_run_id' => $envelope->parentRunId ?? '',
                'skyline.attempt' => $attempt,
                'skyline.queue_time_ms' => ($now - $ready['timestamp']) / 1_000_000,
                'skyline.queue_time_source' => $ready['source'],
                'messaging.system' => 'laravel',
                'messaging.operation.name' => 'process',
                'messaging.message.id' => $envelope->runId,
                'laravel.queue.connection' => $event->connectionName,
                'laravel.job.name' => $job,
            ])
            ->startSpan();
        $span->addEvent('attempt.started');

        $active = new ActiveAttempt(
            $envelope->runId,
            $attempt,
            $span,
            $span->storeInContext(Context::getRoot()),
        );
        $this->attempts->push($active);

        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::RunProcessing,
            $active->runId,
            $active->number,
            $now,
            [
                'trace_id' => $span->getContext()->getTraceId(),
                'parent_run_id' => $envelope->parentRunId,
                'job_name' => $job,
                'connection' => $event->connectionName,
                'confirmation_source' => 'processing',
                'defer_touch' => true,
            ],
        ));
        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::AttemptStarted,
            $active->runId,
            $active->number,
            $now,
            [
                'job_name' => $job,
                'connection' => $event->connectionName,
                'trace_id' => $span->getContext()->getTraceId(),
                'queue_time_ms' => ($now - $ready['timestamp']) / 1_000_000,
                'queue_time_source' => $ready['source'],
            ],
        ));
    }

    private function processed(Job $job): void
    {
        $active = $this->active($job);

        if ($active === null) {
            return;
        }

        if ($job->isReleased()) {
            $active->propose(AttemptResult::Released);

            return;
        }

        if ($job->hasFailed()) {
            $active->propose(AttemptResult::Failed);

            return;
        }

        $active->propose(AttemptResult::Completed);
    }

    private function exception(JobExceptionOccurred $event): void
    {
        $active = $this->active($event->job);

        if ($active === null) {
            return;
        }

        $this->recordException($active, $event->exception);
        $active->propose(AttemptResult::RetryableFailure);
    }

    private function releasedAfterException(JobReleasedAfterException $event): void
    {
        $active = $this->active($event->job);

        if ($active === null) {
            return;
        }

        $exception = $event->exception ?? null;

        if ($exception instanceof Throwable) {
            $this->recordException($active, $exception);
        }

        $active->propose(AttemptResult::RetryableFailure);
    }

    private function failed(JobFailed $event): void
    {
        $active = $this->active($event->job);

        if ($active === null) {
            return;
        }

        $this->recordException($active, $event->exception);
        $active->propose(AttemptResult::Failed);
    }

    private function timedOut(Job $job): void
    {
        $active = $this->active($job);

        if ($active === null) {
            return;
        }

        $active->propose($job->hasFailed() ? AttemptResult::Failed : AttemptResult::RetryableFailure);
        $this->finish($active);
    }

    private function attempted(JobAttempted $event): void
    {
        $active = $this->active($event->job);

        if ($active === null) {
            return;
        }

        $exception = $this->attemptedException($event);

        if ($exception !== null) {
            $this->recordException($active, $exception);
        }

        if ($event->job->hasFailed()) {
            $active->propose(AttemptResult::Failed);
        } elseif ($event->job->isReleased() && $active->exception !== null) {
            $active->propose(AttemptResult::RetryableFailure);
        } elseif ($event->job->isReleased()) {
            $active->propose(AttemptResult::Released);
        } elseif ($exception !== null) {
            $active->propose(AttemptResult::RetryableFailure);
        } else {
            $active->propose(AttemptResult::Completed);
        }

        $this->finish($active);
    }

    private function finish(ActiveAttempt $active): void
    {
        $result = $active->result ?? AttemptResult::Completed;
        $attemptOutcome = $result->attemptOutcome();
        $runStatus = $result->runStatus();

        if ($result === AttemptResult::Completed) {
            $active->span->setStatus(StatusCode::STATUS_OK);
        } elseif ($result->isFailure() && $active->exception === null) {
            $active->span->setStatus(StatusCode::STATUS_ERROR);
        }

        $finishedAt = $this->now();
        $active->span->setAttribute('skyline.outcome', $attemptOutcome);
        $active->span->addEvent('attempt.finished', ['skyline.outcome' => $attemptOutcome], $finishedAt);
        $active->span->end($finishedAt);
        $this->attempts->remove($active);

        if ($runStatus === 'retrying') {
            $this->attempts->rememberReadyAt($active->runId, $finishedAt, 'release_estimate');
        } else {
            $this->attempts->forgetReadyAt($active->runId);
        }

        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::AttemptFinished,
            $active->runId,
            $active->number,
            $finishedAt,
            [
                'attempt_outcome' => $attemptOutcome,
                'run_status' => $runStatus,
            ],
        ));
    }

    private function query(QueryExecuted $query): void
    {
        $active = $this->attempts->current();
        $ignored = $this->persistenceGuard->active()
            || $this->persistenceConnection->owns($query->connectionName);
        $capture = $this->sqlCapture->attributes($query, ! $ignored && $active !== null);

        if ($ignored || $active === null) {
            return;
        }

        $end = $this->now();
        $operation = strtoupper(strtok(ltrim($query->sql), " \t\n\r") ?: 'QUERY');
        $span = $this->tracer->get()->spanBuilder('SQL '.$operation)
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp($end - max(0, (int) round($query->time * 1_000_000)))
            ->setAttributes([
                'skyline.role' => 'sql',
                'skyline.run_id' => $active->runId,
                'skyline.attempt' => $active->number,
                'db.system.name' => $query->connection->getDriverName(),
                'db.namespace' => $query->connectionName,
                'db.query.text' => $query->sql,
                'db.operation.name' => $operation,
                ...$capture,
            ])
            ->startSpan();
        $span->setStatus(StatusCode::STATUS_OK);
        $span->end($end);
    }

    /** @param array<string, mixed> $payload */
    private function jobName(array $payload): string
    {
        $name = $payload['displayName'] ?? $payload['job'] ?? 'unknown';

        return is_string($name) && $name !== '' ? $name : 'unknown';
    }

    private function active(Job $job): ?ActiveAttempt
    {
        $envelope = PayloadEnvelope::fromPayload($job->payload());

        if ($envelope === null) {
            return null;
        }

        return $this->attempts->get($envelope->runId, (int) $job->attempts());
    }

    private function attemptedException(JobAttempted $event): ?Throwable
    {
        $exception = $event->exception ?? null;

        return $exception instanceof Throwable ? $exception : null;
    }

    private function recordException(ActiveAttempt $active, Throwable $exception): void
    {
        if ($active->exceptionRecorded) {
            return;
        }

        $attributes = $this->exceptionAttributes($exception);
        $active->exception = $exception;
        $active->exceptionRecorded = true;
        $active->span->recordException($exception, [
            'exception.type' => $attributes['exception_type'],
            'exception.message' => $attributes['exception_message'],
            'exception.stacktrace' => $attributes['exception_trace'],
        ]);
        $active->span->setStatus(StatusCode::STATUS_ERROR, $attributes['exception_message']);
        $this->lifecycle->record(new LifecycleRecord(
            Lifecycle::AttemptException,
            $active->runId,
            $active->number,
            $this->now(),
            $attributes,
        ));
    }

    /** @return array{exception_type: string, exception_message: string, exception_code: int|string, exception_file: string, exception_line: int, exception_trace: string} */
    private function exceptionAttributes(Throwable $exception): array
    {
        $message = $exception instanceof QueryException
            ? 'Database query failed (SQL: '.$exception->getSql().')'
            : $exception->getMessage();

        return [
            'exception_type' => $exception::class,
            'exception_message' => $message,
            'exception_code' => $exception->getCode(),
            'exception_file' => $exception->getFile(),
            'exception_line' => $exception->getLine(),
            'exception_trace' => $exception->getTraceAsString(),
        ];
    }

    private function listen(string $event, callable $listener): void
    {
        $this->events->listen($event, fn (object $value) => $this->guard(fn () => $listener($value)));
    }

    private function guard(callable $callback, mixed $fallback = null): mixed
    {
        if (! $this->enabled || $this->handling) {
            return $fallback;
        }

        $this->handling = true;

        try {
            return $callback();
        } catch (Throwable $exception) {
            $this->report($exception);

            return $fallback;
        } finally {
            $this->handling = false;
        }
    }

    private function report(Throwable $exception): void
    {
        try {
            $this->logger->warning('Skyline telemetry capture failed.', ['exception' => $exception]);
        } catch (Throwable) {
            // Monitoring failures cannot alter host behavior.
        }
    }

    private function now(): int
    {
        return (int) round(microtime(true) * 1_000_000_000);
    }

    private function traceId(PayloadEnvelope $envelope): ?string
    {
        $traceparent = $envelope->carrier['traceparent'] ?? null;

        if (! is_string($traceparent)
            || ! preg_match('/^[a-f0-9]{2}-([a-f0-9]{32})-[a-f0-9]{16}-[a-f0-9]{2}$/', $traceparent, $matches)
        ) {
            return null;
        }

        return $matches[1];
    }
}
