<?php

use GuzzleHttp\Exception\RequestException;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Queue\Events\JobAttempted;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobTimedOut;
use Illuminate\Queue\Jobs\SyncJob;
use Illuminate\Queue\SyncQueue;
use Illuminate\Queue\Worker;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use NickWelsh\Skyline\Facades\Skyline;
use NickWelsh\Skyline\Telemetry\Lifecycle;
use NickWelsh\Skyline\Telemetry\SqlCapture;
use NickWelsh\Skyline\Telemetry\TelemetrySink;
use OpenTelemetry\API\Trace\Span;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\SDK\Trace\SpanExporter\InMemoryExporter;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\RawMessage;
use Tests\Fixtures\Jobs\CacheJob;
use Tests\Fixtures\Jobs\CustomTelemetryJob;
use Tests\Fixtures\Jobs\DeliveryJob;
use Tests\Fixtures\Jobs\ExceptionRetryJob;
use Tests\Fixtures\Jobs\FailingDeliveryJob;
use Tests\Fixtures\Jobs\FailingHttpJob;
use Tests\Fixtures\Jobs\FailingJob;
use Tests\Fixtures\Jobs\FailingSqlJob;
use Tests\Fixtures\Jobs\HttpJob;
use Tests\Fixtures\Jobs\ParentJob;
use Tests\Fixtures\Jobs\RedisJob;
use Tests\Fixtures\Jobs\RetryJob;
use Tests\Fixtures\Jobs\SqlJob;
use Tests\Fixtures\Jobs\SqlOutputJob;
use Tests\Fixtures\Jobs\StorageProcessJob;
use Tests\Fixtures\Jobs\TransactionJob;
use Tests\Fixtures\Mail\QueuedTestMailable;
use Tests\Fixtures\Mail\TestMailable;
use Tests\Fixtures\RecordingTelemetrySink;

it('captures nested custom spans and events while preserving application behavior', function (): void {
    CustomTelemetryJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $custom = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'custom')
        ->keyBy(fn ($span) => $span->getName());
    $consumer = collect($sink->spans)->first(
        fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer',
    );

    expect($custom)->toHaveKeys(['Generate PDF', 'Upload PDF', 'Async export', 'Fail safely'])
        ->and($custom['Generate PDF']->getParentSpanId())->toBe($consumer->getSpanId())
        ->and($custom['Upload PDF']->getParentSpanId())->toBe($custom['Generate PDF']->getSpanId())
        ->and($custom['Fail safely']->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($custom['Generate PDF']->getEvents())->toHaveCount(1)
        ->and($custom['Generate PDF']->getEvents()[0]->getName())->toBe('Rendered page')
        ->and($custom['Generate PDF']->getAttributes()->get('skyline.custom.source.file'))->toEndWith('CustomTelemetryJob.php')
        ->and(json_encode($custom['Generate PDF']->getEvents()[0]->getAttributes()->toArray()))
        ->not->toContain('stdClass');
});

it('captures mail and per-channel notification delivery without recipient identity or content', function (): void {
    config()->set('mail.default', 'array');
    config()->set('mail.mailers.array', ['transport' => 'array']);

    DeliveryJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $delivery = collect($sink->spans)
        ->filter(fn ($span) => in_array($span->getAttributes()->get('skyline.role'), ['mail', 'notification'], true))
        ->values();
    $mail = $delivery->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'mail')->values();
    $notifications = $delivery->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'notification')->values();

    expect($delivery)->toHaveCount(4)
        ->and($mail)->toHaveCount(2)
        ->and($mail[0]->getAttributes()->get('messaging.message.type'))->toBe(TestMailable::class)
        ->and($mail[0]->getAttributes()->get('messaging.destination.recipient_count'))->toBe(2)
        ->and($mail[1]->getAttributes()->get('messaging.message.type'))->toBe(QueuedTestMailable::class)
        ->and($mail[1]->getParentSpanId())->not->toBe($mail[0]->getParentSpanId())
        ->and($notifications->map(fn ($span) => $span->getName())->all())->toBe(['Notification database', 'Notification slack'])
        ->and($notifications[0]->getStatus()->getCode())->toBe(StatusCode::STATUS_OK)
        ->and($notifications[1]->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR);

    expect(json_encode($delivery->map(fn ($span) => $span->getAttributes()->toArray())->all()))
        ->not->toContain('example.test')
        ->not->toContain('private subject')
        ->not->toContain('private body')
        ->not->toContain('private-route');
});

it('captures storage and process operations without content paths arguments or output', function (): void {
    $root = storage_path('framework/testing/disks/telemetry');
    config()->set('filesystems.disks.telemetry', [
        'driver' => 'local',
        'root' => $root,
        'throw' => true,
    ]);

    StorageProcessJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $storage = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'storage')
        ->values();
    $processes = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'process')
        ->values();

    expect($storage->map(fn ($span) => $span->getAttributes()->get('storage.operation'))->all())
        ->toBe(['write', 'read', 'read_stream', 'copy', 'move', 'size', 'delete', 'delete'])
        ->and($storage[0]->getAttributes()->get('storage.bytes'))->toBe(16)
        ->and($storage[1]->getAttributes()->get('storage.bytes'))->toBe(16)
        ->and($processes)->toHaveCount(4)
        ->and($processes->map(fn ($span) => $span->getAttributes()->get('process.exit_code'))->all())->toBe([0, 7, 0, null])
        ->and($processes[1]->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($processes[3]->getAttributes()->get('process.timed_out'))->toBeTrue();

    expect(json_encode([
        ...$storage->map(fn ($span) => $span->getAttributes()->toArray())->all(),
        ...$processes->map(fn ($span) => $span->getAttributes()->toArray())->all(),
    ]))->not->toContain('private/customer')
        ->not->toContain('private contents')
        ->not->toContain('private output')
        ->not->toContain('exit(7)');
});

it('records handled mail transport failures without changing application control flow', function (): void {
    app('mail.manager')->extend('skyline-failing', fn () => new class implements TransportInterface
    {
        public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
        {
            throw new TransportException('private transport failure');
        }

        public function __toString(): string
        {
            return 'skyline-failing';
        }
    });
    config()->set('mail.default', 'failure');
    config()->set('mail.mailers.failure', ['transport' => 'skyline-failing']);

    FailingDeliveryJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $mail = collect($sink->spans)->first(
        fn ($span) => $span->getAttributes()->get('skyline.role') === 'mail',
    );
    $consumer = collect($sink->spans)->first(
        fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer',
    );

    expect($mail->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($mail->getAttributes()->get('messaging.operation.outcome'))->toBe('incomplete')
        ->and($consumer->getStatus()->getCode())->toBe(StatusCode::STATUS_OK)
        ->and(json_encode($mail->getAttributes()->toArray()))->not->toContain('private transport failure');
});

it('leaves Laravel mail fakes unchanged and does not invent delivery spans', function (): void {
    Mail::fake();

    FailingDeliveryJob::dispatchSync();

    Mail::assertSent(TestMailable::class);

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);

    expect(collect($sink->spans)->contains(
        fn ($span) => $span->getAttributes()->get('skyline.role') === 'mail',
    ))->toBeFalse();
});

it('captures nested rolled-back and multi-connection database transactions', function (): void {
    config()->set('database.connections.secondary', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ]);

    TransactionJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $transactions = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'transaction')
        ->values();
    $queries = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'sql')
        ->filter(fn ($span) => str_contains($span->getAttributes()->get('db.query.text'), '_value'))
        ->values();
    $outer = $transactions->first(fn ($span) => $span->getAttributes()->get('db.transaction.depth') === 1
        && $span->getAttributes()->get('db.namespace') === 'testing'
        && $span->getStatus()->getCode() === StatusCode::STATUS_OK);
    $nested = $transactions->first(fn ($span) => $span->getAttributes()->get('db.transaction.depth') === 2);
    $rolledBack = $transactions->first(fn ($span) => $span->getAttributes()->get('db.transaction.outcome') === 'rolled_back');
    $secondary = $transactions->first(fn ($span) => $span->getAttributes()->get('db.namespace') === 'secondary');

    expect($transactions)->toHaveCount(4)
        ->and($nested->getParentSpanId())->toBe($outer->getSpanId())
        ->and($rolledBack->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($secondary)->not->toBeNull()
        ->and($queries)->toHaveCount(4)
        ->and($queries[0]->getParentSpanId())->toBe($outer->getSpanId())
        ->and($queries[1]->getParentSpanId())->toBe($nested->getSpanId())
        ->and($rolledBack->getAttributes()->get('db.transaction.query_time_ms'))->toBeGreaterThanOrEqual(0)
        ->and(json_encode($transactions->map(fn ($span) => $span->getAttributes()->toArray())->all()))
        ->not->toContain('rollback reason');
});

it('is a no-op outside an active Attempt', function (): void {
    $value = Skyline::measure('Outside', fn (): string => 'unchanged');
    Skyline::event('Outside event');

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);

    expect($value)->toBe('unchanged')
        ->and($sink->spans)->toBe([]);
});

it('captures cache operations without values or raw keys', function (): void {
    CacheJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $cache = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'cache')
        ->values();
    $consumer = collect($sink->spans)->first(
        fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer',
    );

    expect($cache)->toHaveCount(4)
        ->and($cache->map(fn ($span) => $span->getName())->all())->toBe(['Cache PUT', 'Cache GET', 'Cache GET', 'Cache FORGET'])
        ->and($cache[1]->getAttributes()->get('cache.hit'))->toBeTrue()
        ->and($cache[2]->getAttributes()->get('cache.hit'))->toBeFalse()
        ->and($cache[0]->getAttributes()->get('cache.ttl'))->toBe(60)
        ->and($cache->every(fn ($span) => $span->getParentSpanId() === $consumer->getSpanId()))->toBeTrue();

    expect(json_encode($cache->map(fn ($span) => $span->getAttributes()->toArray())->all()))
        ->not->toContain('private-value')
        ->not->toContain('secret@example.test');
});

it('captures direct Redis commands without duplicating cache-backed commands', function (): void {
    RedisJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $redis = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'redis')
        ->values();
    $cache = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'cache')
        ->values();

    expect($redis)->toHaveCount(1)
        ->and($redis[0]->getName())->toBe('Redis SET')
        ->and($redis[0]->getAttributes()->get('db.namespace'))->toBe('default')
        ->and($cache)->toHaveCount(1)
        ->and($cache[0]->getName())->toBe('Cache GET')
        ->and(json_encode($redis[0]->getAttributes()->toArray()))->not->toContain('private');
});

function setUpDatabaseQueue(): void
{
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

it('emits a producer, Attempt consumer, and parameterized SQL span for an unchanged sync Job', function (): void {
    $payload = null;
    Event::listen(JobProcessing::class, function (JobProcessing $event) use (&$payload): void {
        $payload = $event->job->payload();
    });

    SqlJob::dispatchSync('job-payload-secret');

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $spans = collect($sink->spans)->keyBy(fn ($span) => $span->getAttributes()->get('skyline.role'));

    expect($spans)->toHaveKeys(['producer', 'consumer', 'sql'])
        ->and($spans['producer']->getKind())->toBe(SpanKind::KIND_PRODUCER)
        ->and($spans['consumer']->getKind())->toBe(SpanKind::KIND_CONSUMER)
        ->and($spans['sql']->getKind())->toBe(SpanKind::KIND_CLIENT)
        ->and($spans['consumer']->getParentSpanId())->toBe($spans['producer']->getSpanId())
        ->and($spans['sql']->getParentSpanId())->toBe($spans['consumer']->getSpanId())
        ->and($spans['sql']->getAttributes()->get('db.query.text'))->toBe('select ? as private_value')
        ->and($spans['sql']->getAttributes()->get('skyline.sql.source.file'))->toBeNull();

    $capturedAttributes = [
        ...array_map(fn ($record) => $record->attributes, $sink->lifecycle),
        ...array_map(fn ($span) => $span->getAttributes()->toArray(), $sink->spans),
    ];

    expect(json_encode($capturedAttributes))
        ->not->toContain('do-not-capture')
        ->not->toContain('job-payload-secret');

    expect($payload['skyline'])->toHaveKeys(['v', 'run_id', 'parent_run_id', 'queued_at_ns', 'carrier'])
        ->and($payload['skyline']['v'])->toBe(1)
        ->and($payload['skyline']['run_id'])->toBe($payload['uuid'])
        ->and($payload['skyline']['carrier']['traceparent'])->toMatch('/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/');

    expect(array_map(fn ($record) => $record->type, $sink->lifecycle))->toBe([
        Lifecycle::RunDispatched,
        Lifecycle::RunProcessing,
        Lifecycle::AttemptStarted,
        Lifecycle::AttemptFinished,
    ])->and($sink->lifecycle[3]->attributes)->toMatchArray([
        'attempt_outcome' => 'completed',
        'run_status' => 'completed',
    ]);
});

it('captures bounded redacted SQL bindings and outputs only when opted in', function (): void {
    config()->set('skyline.sql.capture_bindings', true);
    config()->set('skyline.sql.capture_results', true);
    config()->set('skyline.sql.capture_source', true);
    config()->set('skyline.sql.max_result_rows', 1);
    app(SqlCapture::class)->boot();

    Schema::create('sql_capture_values', function (Blueprint $table): void {
        $table->id();
        $table->string('name');
        $table->string('password');
        $table->string('api_token');
    });

    SqlOutputJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $sql = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'sql');
    $insert = $sql->first(fn ($span) => $span->getAttributes()->get('db.operation.name') === 'INSERT');
    $select = $sql->first(fn ($span) => $span->getAttributes()->get('db.operation.name') === 'SELECT');
    $bindings = json_decode($insert->getAttributes()->get('skyline.sql.bindings'), true, flags: JSON_THROW_ON_ERROR);
    $write = json_decode($insert->getAttributes()->get('skyline.sql.result'), true, flags: JSON_THROW_ON_ERROR);
    $result = json_decode($select->getAttributes()->get('skyline.sql.result'), true, flags: JSON_THROW_ON_ERROR);
    $source = $select->getAttributes()->get('skyline.sql.source.file');

    expect($bindings['items'])->toContain([
        'position' => 0,
        'column' => 'name',
        'value' => 'first-visible',
    ])->and(json_encode($bindings))->not->toContain('password-secret')->not->toContain('token-secret')
        ->and($write)->toMatchArray(['kind' => 'affected', 'affectedRows' => 1])
        ->and($result['kind'])->toBe('rows')
        ->and($result['rowCount'])->toBe(2)
        ->and($result['truncated'])->toBeTrue()
        ->and($result['rows'])->toHaveCount(1)
        ->and($source)->toEndWith('tests/Fixtures/Jobs/SqlOutputJob.php')
        ->and($select->getAttributes()->get('skyline.sql.source.line'))->toBeInt()->toBeGreaterThan(0)
        ->and($result['rows'][0])->toMatchArray([
            'name' => 'first-visible',
            'password' => '[REDACTED]',
            'api_token' => '[REDACTED]',
        ]);
});

it('captures Laravel and direct Guzzle requests without sensitive output by default', function (): void {
    Http::fake([
        'api.example.test/*' => Http::response(['id' => 42], 201, [
            'Content-Type' => 'application/json',
            'Set-Cookie' => 'session=response-secret',
        ]),
    ]);

    HttpJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $spans = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'http')
        ->values();

    expect($spans)->toHaveCount(2)
        ->and($spans[0]->getKind())->toBe(SpanKind::KIND_CLIENT)
        ->and($spans[0]->getParentSpanId())->not->toBe('')
        ->and($spans[0]->getAttributes()->get('http.request.method'))->toBe('POST')
        ->and($spans[0]->getAttributes()->get('skyline.http.client'))->toBe('laravel')
        ->and($spans[0]->getAttributes()->get('url.full'))->toBe('https://api.example.test/people?token=%5BREDACTED%5D')
        ->and($spans[0]->getAttributes()->get('http.response.status_code'))->toBe(201)
        ->and($spans[1]->getAttributes()->get('http.request.method'))->toBe('PUT')
        ->and($spans[1]->getAttributes()->get('skyline.http.client'))->toBe('guzzle')
        ->and($spans[1]->getAttributes()->get('url.full'))->toBe('https://direct.example.test/jobs/42?signature=%5BREDACTED%5D')
        ->and($spans[1]->getAttributes()->get('http.response.status_code'))->toBe(202);

    expect(json_encode($spans->map(fn ($span) => $span->getAttributes()->toArray())->all()))
        ->not->toContain('request-secret')
        ->not->toContain('response-secret')
        ->not->toContain('query-secret')
        ->not->toContain('direct-secret')
        ->not->toContain('body-secret')
        ->not->toContain('Laravel')
        ->not->toContain('accepted');
});

it('captures bounded redacted HTTP headers bodies query and source when opted in', function (): void {
    config()->set('skyline.http.capture_query', true);
    config()->set('skyline.http.capture_request_headers', true);
    config()->set('skyline.http.capture_request_body', true);
    config()->set('skyline.http.capture_response_headers', true);
    config()->set('skyline.http.capture_response_body', true);
    config()->set('skyline.http.capture_source', true);
    config()->set('skyline.http.header_allowlist', [...config('skyline.http.header_allowlist'), 'x-visible']);

    Http::fake([
        'api.example.test/*' => Http::response(['id' => 42], 201, [
            'Content-Type' => 'application/json',
            'Set-Cookie' => 'session=response-secret',
        ]),
    ]);

    HttpJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $span = collect($sink->spans)
        ->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'http');
    $attributes = $span->getAttributes();
    $requestHeaders = json_decode($attributes->get('skyline.http.request.headers'), true, flags: JSON_THROW_ON_ERROR);
    $requestBody = json_decode($attributes->get('skyline.http.request.body'), true, flags: JSON_THROW_ON_ERROR);
    $responseHeaders = json_decode($attributes->get('skyline.http.response.headers'), true, flags: JSON_THROW_ON_ERROR);
    $responseBody = json_decode($attributes->get('skyline.http.response.body'), true, flags: JSON_THROW_ON_ERROR);

    expect($attributes->get('url.full'))->toBe('https://api.example.test/people?token=query-secret')
        ->and($requestHeaders['items']['Authorization'])->toBe(['[REDACTED]'])
        ->and($requestHeaders['items']['X-Visible'])->toBe(['laravel'])
        ->and(json_decode($requestBody['value'], true))->toMatchArray(['name' => 'Laravel', 'api_token' => '[REDACTED]'])
        ->and($requestBody)->toMatchArray(['contentType' => 'application/json', 'truncated' => false])
        ->and($responseHeaders['items']['Set-Cookie'])->toBe(['[REDACTED]'])
        ->and($responseBody)->toMatchArray(['value' => '{"id":42}', 'contentType' => 'application/json', 'truncated' => false])
        ->and($attributes->get('skyline.http.source.file'))->toEndWith('tests/Fixtures/Jobs/HttpJob.php')
        ->and($attributes->get('skyline.http.source.line'))->toBeInt()->toBeGreaterThan(0);

    expect(json_encode([$requestHeaders, $responseHeaders]))
        ->not->toContain('request-secret')
        ->not->toContain('response-secret')
        ->and($requestBody['value'])->not->toContain('body-secret');
});

it('records asynchronous Guzzle failures without changing the rejection', function (): void {
    FailingHttpJob::$preserved = false;

    FailingHttpJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $span = collect($sink->spans)
        ->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'http');

    expect(FailingHttpJob::$preserved)->toBeTrue()
        ->and($span->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($span->getAttributes()->get('error.type'))->toBe(RequestException::class)
        ->and(json_encode($span->getAttributes()->toArray()))->not->toContain('transport-secret');
});

it('keeps one Run across queued retry Attempts with exact and estimated queue-time provenance', function (): void {
    setUpDatabaseQueue();

    RetryJob::dispatch()->onConnection('database');
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(sleep: 0, maxTries: 2);
    $worker->runNextJob('database', 'default', $options);
    $worker->runNextJob('database', 'default', $options);

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $attempts = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer')
        ->values();
    $finished = collect($sink->lifecycle)->where('type', Lifecycle::AttemptFinished)->values();

    expect($attempts)->toHaveCount(2)
        ->and($attempts->pluck(fn ($span) => $span->getAttributes()->get('skyline.attempt'))->all())->toBe([1, 2])
        ->and($attempts->pluck(fn ($span) => $span->getAttributes()->get('skyline.run_id'))->unique())->toHaveCount(1)
        ->and($attempts[0]->getAttributes()->get('skyline.queue_time_source'))->toBe('queued')
        ->and($attempts[1]->getAttributes()->get('skyline.queue_time_source'))->toBe('release_estimate')
        ->and($finished->pluck('attributes')->all())->toBe([
            ['attempt_outcome' => 'released', 'run_status' => 'retrying'],
            ['attempt_outcome' => 'completed', 'run_status' => 'completed'],
        ]);
});

it('records an exception-released delivery as a failed Attempt on a retrying Run', function (): void {
    setUpDatabaseQueue();

    ExceptionRetryJob::dispatch()->onConnection('database');
    /** @var Worker $worker */
    $worker = app('queue.worker');
    $options = new WorkerOptions(backoff: 0, sleep: 0, maxTries: 2);
    $worker->runNextJob('database', 'default', $options);
    $worker->runNextJob('database', 'default', $options);

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $attempts = collect($sink->spans)
        ->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer')
        ->values();
    $finished = collect($sink->lifecycle)->where('type', Lifecycle::AttemptFinished)->values();

    expect($finished->pluck('attributes')->all())->toBe([
        ['attempt_outcome' => 'failed', 'run_status' => 'retrying'],
        ['attempt_outcome' => 'completed', 'run_status' => 'completed'],
    ])->and($attempts[0]->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($attempts[1]->getStatus()->getCode())->toBe(StatusCode::STATUS_OK);
});

it('reduces exception event ordering to one failed Attempt', function (): void {
    expect(fn () => FailingJob::dispatchSync())->toThrow(RuntimeException::class, 'Expected Job failure.');

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $consumer = collect($sink->spans)->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer');
    $types = array_map(fn ($record) => $record->type, $sink->lifecycle);

    expect($types)->toBe([
        Lifecycle::RunDispatched,
        Lifecycle::RunProcessing,
        Lifecycle::AttemptStarted,
        Lifecycle::AttemptException,
        Lifecycle::AttemptFinished,
    ])->and($sink->lifecycle[4]->attributes)->toMatchArray([
        'attempt_outcome' => 'failed',
        'run_status' => 'failed',
    ])->and($consumer->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($consumer->getAttributes()->get('skyline.outcome'))->toBe('failed');
});

it('keeps failure terminal when processed arrives before failed', function (): void {
    $queue = new class extends SyncQueue
    {
        public function payload(object $job): string
        {
            return $this->createPayload($job, 'sync');
        }
    };
    $queue->setContainer(app());
    $queue->setConnectionName('sync');
    $job = new SyncJob(app(), $queue->payload(new SqlJob), 'sync', 'sync');
    $exception = new RuntimeException('Late failure.');

    Event::dispatch(new JobProcessing('sync', $job));
    Event::dispatch(new JobProcessed('sync', $job));
    Event::dispatch(new JobFailed('sync', $job, $exception));
    Event::dispatch(new JobAttempted('sync', $job, $exception));

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $consumer = collect($sink->spans)->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer');
    $finished = collect($sink->lifecycle)->where('type', Lifecycle::AttemptFinished)->values();

    expect($finished)->toHaveCount(1)
        ->and($finished[0]->attributes)->toMatchArray([
            'attempt_outcome' => 'failed',
            'run_status' => 'failed',
        ])->and($consumer->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR)
        ->and($consumer->getAttributes()->get('skyline.outcome'))->toBe('failed');
});

it('excludes SQL bindings from database exception telemetry', function (): void {
    expect(fn () => FailingSqlJob::dispatchSync())->toThrow(QueryException::class);

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $captured = array_map(fn ($record) => $record->attributes, $sink->lifecycle);

    foreach ($sink->spans as $span) {
        $captured[] = $span->getAttributes()->toArray();
        $captured[] = ['status_description' => $span->getStatus()->getDescription()];

        foreach ($span->getEvents() as $event) {
            $captured[] = $event->getAttributes()->toArray();
        }
    }

    expect(json_encode($captured))
        ->not->toContain('sql-binding-secret')
        ->toContain('missing_table');
});

it('settles timeout once as a retryable failed Attempt', function (): void {
    $queue = new class extends SyncQueue
    {
        public function payload(object $job): string
        {
            return $this->createPayload($job, 'sync');
        }
    };
    $queue->setContainer(app());
    $queue->setConnectionName('sync');
    $job = new SyncJob(app(), $queue->payload(new SqlJob), 'sync', 'sync');

    Event::dispatch(new JobProcessing('sync', $job));
    Event::dispatch(new JobTimedOut('sync', $job));
    Event::dispatch(new JobAttempted('sync', $job));

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $consumer = collect($sink->spans)->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer');
    $finished = collect($sink->lifecycle)->where('type', Lifecycle::AttemptFinished)->values();

    expect($finished)->toHaveCount(1)
        ->and($finished[0]->attributes)->toMatchArray([
            'attempt_outcome' => 'failed',
            'run_status' => 'retrying',
        ])->and($consumer->getStatus()->getCode())->toBe(StatusCode::STATUS_ERROR);
});

it('never changes Job outcomes when the sink fails', function (): void {
    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $sink->throws = true;

    SqlJob::dispatchSync();

    expect(fn () => FailingJob::dispatchSync())->toThrow(RuntimeException::class, 'Expected Job failure.');
});

it('ignores duplicate terminal lifecycle events', function (): void {
    $job = null;
    Event::listen(JobProcessing::class, function (JobProcessing $event) use (&$job): void {
        $job = $event->job;
    });

    SqlJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $lifecycleCount = count($sink->lifecycle);
    $spanCount = count($sink->spans);

    Event::dispatch(new JobProcessed('sync', $job));
    Event::dispatch(new JobAttempted('sync', $job));

    expect($sink->lifecycle)->toHaveCount($lifecycleCount)
        ->and($sink->spans)->toHaveCount($spanCount);
});

it('captures after-response Jobs through the sync lifecycle', function (): void {
    SqlJob::dispatchAfterResponse();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);

    expect($sink->spans)->toBeEmpty();

    app()->terminate();

    $consumer = collect($sink->spans)->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer');

    expect($sink->spans)->toHaveCount(3)
        ->and($consumer->getAttributes()->get('skyline.queue_time_source'))->toBe('sync')
        ->and($consumer->getAttributes()->get('skyline.queue_time_ms'))->toBe(0);
});

it('parents child Runs to the active Attempt without activating Skyline globally', function (): void {
    ParentJob::dispatchSync();

    /** @var RecordingTelemetrySink $sink */
    $sink = app(TelemetrySink::class);
    $spans = collect($sink->spans);
    $producers = $spans->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'producer')->values();
    $consumers = $spans->filter(fn ($span) => $span->getAttributes()->get('skyline.role') === 'consumer')->values();
    $rootProducer = $producers->first(fn ($span) => $span->getAttributes()->get('skyline.parent_run_id') === '');
    $childProducer = $producers->first(fn ($span) => $span->getAttributes()->get('skyline.parent_run_id') !== '');
    $rootAttempt = $consumers->first(fn ($span) => $span->getAttributes()->get('skyline.run_id') === $rootProducer->getAttributes()->get('skyline.run_id'));
    $childAttempt = $consumers->first(fn ($span) => $span->getAttributes()->get('skyline.run_id') === $childProducer->getAttributes()->get('skyline.run_id'));

    expect($spans)->toHaveCount(4)
        ->and($childProducer->getTraceId())->toBe($rootProducer->getTraceId())
        ->and($rootAttempt->getParentSpanId())->toBe($rootProducer->getSpanId())
        ->and($childProducer->getParentSpanId())->toBe($rootAttempt->getSpanId())
        ->and($childAttempt->getParentSpanId())->toBe($childProducer->getSpanId());
});

it('isolates root Runs from an active host provider while retaining a link', function (): void {
    $hostExporter = new InMemoryExporter;
    $hostProvider = new TracerProvider(new SimpleSpanProcessor($hostExporter));
    $hostSpan = $hostProvider->getTracer('host')->spanBuilder('host request')->startSpan();
    $scope = $hostSpan->activate();

    try {
        SqlJob::dispatchSync();

        /** @var RecordingTelemetrySink $sink */
        $sink = app(TelemetrySink::class);
        $producer = collect($sink->spans)->first(fn ($span) => $span->getAttributes()->get('skyline.role') === 'producer');

        expect($producer->getParentContext()->isValid())->toBeFalse()
            ->and($producer->getTraceId())->not->toBe($hostSpan->getContext()->getTraceId())
            ->and($producer->getLinks())->toHaveCount(1)
            ->and($producer->getLinks()[0]->getSpanContext()->getSpanId())->toBe($hostSpan->getContext()->getSpanId())
            ->and(Span::getCurrent()->getContext()->getSpanId())->toBe($hostSpan->getContext()->getSpanId());
    } finally {
        $scope->detach();
        $hostSpan->end();
    }

    expect($hostExporter->getSpans())->toHaveCount(1);
});
