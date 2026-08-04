<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Telemetry\Lifecycle;
use NickWelsh\Skyline\Telemetry\LifecycleRecord;
use NickWelsh\Skyline\Telemetry\SinkSpanExporter;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\Context\Context;
use OpenTelemetry\SDK\Trace\Sampler\AlwaysOnSampler;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use Tests\Fixtures\Jobs\SqlJob;

it('persists normalized Run, Attempt, and immutable spans without observing its own writes', function (): void {
    SqlJob::dispatchSync('job-payload-secret');

    $run = DB::table('skyline_runs')->first();
    $attempt = DB::table('skyline_attempts')->first();
    $spans = DB::table('skyline_spans')->orderBy('started_at')->get();

    expect(DB::table('skyline_traces')->count())->toBe(1)
        ->and(DB::table('skyline_runs')->count())->toBe(1)
        ->and(DB::table('skyline_attempts')->count())->toBe(1)
        ->and(DB::table('skyline_spans')->count())->toBe(3)
        ->and($run->status)->toBe('completed')
        ->and($run->confirmed_at)->not->toBeNull()
        ->and($attempt->status)->toBe('completed')
        ->and($spans->pluck('role')->sort()->values()->all())->toBe(['consumer', 'producer', 'sql'])
        ->and($spans->firstWhere('role', 'sql')->attributes)->toContain('select ? as private_value')
        ->not->toContain('job-payload-secret')
        ->not->toContain('do-not-capture');
});

it('buffers Attempt spans until the terminal lifecycle transaction', function (): void {
    /** @var PersistentTelemetrySink $sink */
    $sink = app(PersistentTelemetrySink::class);
    $provider = new TracerProvider(
        new SimpleSpanProcessor(new SinkSpanExporter($sink, app('log'))),
        new AlwaysOnSampler,
    );
    $tracer = $provider->getTracer('skyline-persistence-test');
    $runId = 'run-buffered';
    $startedAt = (int) round(microtime(true) * 1_000_000_000);
    $producer = $tracer->spanBuilder('Buffered Job dispatch')
        ->setStartTimestamp($startedAt)
        ->setSpanKind(SpanKind::KIND_PRODUCER)
        ->setAttributes([
            'skyline.role' => 'producer',
            'skyline.run_id' => $runId,
            'skyline.parent_run_id' => '',
            'laravel.job.name' => 'Buffered Job',
        ])->startSpan();

    $sink->recordLifecycle(new LifecycleRecord(Lifecycle::RunDispatched, $runId, null, $startedAt, [
        'trace_id' => $producer->getContext()->getTraceId(),
        'job_name' => 'Buffered Job',
    ]));
    $producer->end($startedAt + 1);
    $sink->recordLifecycle(new LifecycleRecord(Lifecycle::RunProcessing, $runId, 1, $startedAt + 2, [
        'trace_id' => $producer->getContext()->getTraceId(),
        'job_name' => 'Buffered Job',
    ]));
    $sink->recordLifecycle(new LifecycleRecord(Lifecycle::AttemptStarted, $runId, 1, $startedAt + 2));
    $consumer = $tracer->spanBuilder('Buffered Job attempt 1')
        ->setParent($producer->storeInContext(Context::getRoot()))
        ->setStartTimestamp($startedAt + 2)
        ->setSpanKind(SpanKind::KIND_CONSUMER)
        ->setAttributes([
            'skyline.role' => 'consumer',
            'skyline.run_id' => $runId,
            'skyline.attempt' => 1,
        ])->startSpan();
    $sql = $tracer->spanBuilder('SQL SELECT')
        ->setParent($consumer->storeInContext(Context::getRoot()))
        ->setStartTimestamp($startedAt + 3)
        ->setSpanKind(SpanKind::KIND_CLIENT)
        ->setAttributes([
            'skyline.role' => 'sql',
            'skyline.run_id' => $runId,
            'skyline.attempt' => 1,
            'db.query.text' => 'select ?',
        ])->startSpan();
    $sql->end($startedAt + 4);
    $consumer->end($startedAt + 5);

    expect(DB::table('skyline_spans')->pluck('role')->all())->toBe(['producer']);

    $sink->recordLifecycle(new LifecycleRecord(Lifecycle::AttemptFinished, $runId, 1, $startedAt + 6, [
        'attempt_outcome' => 'completed',
        'run_status' => 'completed',
    ]));

    expect(DB::table('skyline_spans')->pluck('role')->sort()->values()->all())
        ->toBe(['consumer', 'producer', 'sql']);
});

it('keeps lifecycle and span replays idempotent', function (): void {
    SqlJob::dispatchSync();

    $trace = DB::table('skyline_traces')->first();
    $revision = $trace->revision;
    $run = DB::table('skyline_runs')->first();
    $attempt = DB::table('skyline_attempts')->first();

    /** @var PersistentTelemetrySink $sink */
    $sink = app(PersistentTelemetrySink::class);
    $sink->recordLifecycle(new LifecycleRecord(Lifecycle::AttemptFinished, $run->run_id, 1, $attempt->finished_at, [
        'attempt_outcome' => $attempt->status,
        'run_status' => $run->status,
    ]));

    expect(DB::table('skyline_traces')->where('trace_id', $trace->trace_id)->value('revision'))->toBe($revision)
        ->and(DB::table('skyline_spans')->where('trace_id', $trace->trace_id)->count())->toBe(3);
});

it('does not let late lifecycle records downgrade terminal state', function (): void {
    SqlJob::dispatchSync();

    $run = DB::table('skyline_runs')->first();
    $attempt = DB::table('skyline_attempts')->first();
    $trace = DB::table('skyline_traces')->first();
    /** @var PersistentTelemetrySink $sink */
    $sink = app(PersistentTelemetrySink::class);
    $sink->recordLifecycle(new LifecycleRecord(
        Lifecycle::RunProcessing,
        $run->run_id,
        1,
        $run->finished_at + 1,
        ['trace_id' => $trace->trace_id],
    ));
    $sink->recordLifecycle(new LifecycleRecord(
        Lifecycle::AttemptFinished,
        $run->run_id,
        1,
        $run->finished_at + 2,
        ['attempt_outcome' => 'released', 'run_status' => 'retrying'],
    ));

    expect(DB::table('skyline_runs')->where('run_id', $run->run_id)->value('status'))->toBe('completed')
        ->and(DB::table('skyline_attempts')->where('id', $attempt->id)->value('status'))->toBe('completed')
        ->and(DB::table('skyline_traces')->where('trace_id', $trace->trace_id)->value('revision'))
        ->toBe($trace->revision);
});
