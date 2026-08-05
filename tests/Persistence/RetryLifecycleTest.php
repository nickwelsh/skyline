<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Queue\Events\JobAttempted;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobReleasedAfterException;
use Illuminate\Queue\Events\Looping;
use Illuminate\Queue\Jobs\SyncJob;
use Illuminate\Queue\SyncQueue;
use Illuminate\Queue\Worker;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use NickWelsh\Skyline\Persistence\FailureReporter;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Persistence\SkylineConnection;
use NickWelsh\Skyline\Telemetry\AttemptSequence;
use NickWelsh\Skyline\Telemetry\TelemetrySink;
use Tests\Fixtures\Jobs\ExceptionRetryJob;
use Tests\Fixtures\Jobs\ThreeAttemptJob;

it('persists every queued retry Attempt and the terminal Run status', function (): void {
    setUpPersistentDatabaseQueue();

    ExceptionRetryJob::dispatch()->onConnection('database');
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 2);
    $worker->runNextJob('database', 'default', $options);
    $worker->runNextJob('database', 'default', $options);

    $run = DB::table('skyline_runs')->where('job_name', ExceptionRetryJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect($run->status)->toBe('completed')
        ->and($attempts)->toHaveCount(2)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'completed']);
});

it('persists three failed Attempts and marks the Run failed', function (): void {
    config()->set('skyline.batch.max_operations', 5_000);
    config()->set('skyline.batch.max_delay_ms', 2_000);
    setUpPersistentDatabaseQueue();

    ThreeAttemptJob::dispatch()->onConnection('database');
    app(PersistentTelemetrySink::class)->flush();
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 3);
    $worker->runNextJob('database', 'default', $options);
    app(PersistentTelemetrySink::class)->flush();

    expect(DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->value('status'))->toBe('retrying')
        ->and(DB::table('skyline_attempts')->count())->toBe(1);

    $worker->runNextJob('database', 'default', $options);
    $worker->runNextJob('database', 'default', $options);

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();
    $trace = $this->getJson('/skyline/api/runs/'.$run->run_id)->assertOk();

    expect($run->status)->toBe('failed')
        ->and($attempts)->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'failed'])
        ->and(collect($trace->json('trace.nodes'))->where('kind', 'attempt'))->toHaveCount(3);
});

it('finalizes retries when the runner omits JobAttempted', function (): void {
    config()->set('skyline.batch.max_operations', 5_000);
    config()->set('skyline.batch.max_delay_ms', 2_000);
    setUpPersistentDatabaseQueue();

    ThreeAttemptJob::dispatch()->onConnection('database');
    app(PersistentTelemetrySink::class)->flush();
    app('events')->forget(JobAttempted::class);

    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 3);

    foreach (range(1, 3) as $_) {
        $worker->runNextJob('database', 'default', $options);
    }

    app(PersistentTelemetrySink::class)->flush();

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect($run->status)->toBe('failed')
        ->and($attempts)->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'failed']);
});

it('completes a successful retry when the runner omits JobAttempted', function (): void {
    config()->set('skyline.batch.max_operations', 5_000);
    config()->set('skyline.batch.max_delay_ms', 2_000);
    setUpPersistentDatabaseQueue();

    ThreeAttemptJob::dispatch(3)->onConnection('database');
    app(PersistentTelemetrySink::class)->flush();
    app('events')->forget(JobAttempted::class);

    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 3);

    foreach (range(1, 3) as $_) {
        $worker->runNextJob('database', 'default', $options);
    }

    app('events')->dispatch(new Looping('database', 'default', $options));

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect($run->status)->toBe('completed')
        ->and($attempts)->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'completed']);
});

it('does not collapse repeated native attempt numbers onto Attempt one', function (): void {
    replayRepeatedNativeAttempts();

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect([
        'status' => $run->status,
        'attempt_count' => $attempts->count(),
    ])->toBe([
        'status' => 'failed',
        'attempt_count' => 3,
    ])->and($attempts)
        ->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'failed']);
});

it('completes repeated native attempt numbers on the third try', function (): void {
    replayRepeatedNativeAttempts(succeeds: true);

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect($run->status)->toBe('completed')
        ->and($attempts)->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'completed']);
});

it('continues the Attempt sequence from persistence after a worker restart', function (): void {
    setUpPersistentDatabaseQueue();

    ThreeAttemptJob::dispatch()->onConnection('database');
    app(PersistentTelemetrySink::class)->flush();
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $worker->runNextJob('database', 'default', new WorkerOptions(backoff: 0, sleep: 0, maxTries: 3));

    $runId = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->value('run_id');
    $freshWorkerSequence = new AttemptSequence(
        app(SkylineConnection::class),
        app(PersistenceGuard::class),
        app(FailureReporter::class),
        app(TelemetrySink::class),
    );

    expect($freshWorkerSequence->next($runId, 1))->toBe(2);
});

function replayRepeatedNativeAttempts(bool $succeeds = false): void
{
    $queue = new class extends SyncQueue
    {
        public function payload(object $job): string
        {
            return $this->createPayload($job, 'sync');
        }
    };
    $queue->setContainer(app());
    $queue->setConnectionName('sync');
    $payload = $queue->payload(new ThreeAttemptJob);

    foreach (range(1, 3) as $number) {
        $job = new SyncJob(app(), $payload, 'sync', 'default');
        $exception = new RuntimeException('Failure '.$number.'.');
        Event::dispatch(new JobProcessing('sync', $job));

        if ($number < 3) {
            Event::dispatch(new JobExceptionOccurred('sync', $job, $exception));
            $job->release();
            Event::dispatch(new JobReleasedAfterException('sync', $job, 0, $exception));

            continue;
        }

        if ($succeeds) {
            Event::dispatch(new JobProcessed('sync', $job));
            Event::dispatch(new Looping('sync', 'default'));
        } else {
            Event::dispatch(new JobFailed('sync', $job, $exception));
            Event::dispatch(new JobExceptionOccurred('sync', $job, $exception));
        }
    }
}

it('persists two failed Attempts before a successful third Attempt', function (): void {
    config()->set('skyline.batch.max_operations', 5_000);
    config()->set('skyline.batch.max_delay_ms', 2_000);
    setUpPersistentDatabaseQueue();

    ThreeAttemptJob::dispatch(3)->onConnection('database');
    app(PersistentTelemetrySink::class)->flush();
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 3);

    foreach (range(1, 3) as $_) {
        $worker->runNextJob('database', 'default', $options);
    }

    $run = DB::table('skyline_runs')->where('job_name', ThreeAttemptJob::class)->first();
    $attempts = DB::table('skyline_attempts')->where('run_id', $run->run_id)->orderBy('attempt_number')->get();

    expect($run->status)->toBe('completed')
        ->and($attempts)->toHaveCount(3)
        ->and($attempts->pluck('attempt_number')->all())->toBe([1, 2, 3])
        ->and($attempts->pluck('status')->all())->toBe(['failed', 'failed', 'completed']);
});

function setUpPersistentDatabaseQueue(): void
{
    config()->set('queue.default', 'database');
    config()->set('queue.connections.database', [
        'driver' => 'database',
        'connection' => 'testing',
        'table' => 'jobs',
        'queue' => 'default',
        'retry_after' => 60,
        'after_commit' => false,
    ]);
    Schema::create('jobs', function (Blueprint $table): void {
        $table->id();
        $table->string('queue')->index();
        $table->longText('payload');
        $table->unsignedTinyInteger('attempts');
        $table->unsignedInteger('reserved_at')->nullable();
        $table->unsignedInteger('available_at');
        $table->unsignedInteger('created_at');
    });
}
