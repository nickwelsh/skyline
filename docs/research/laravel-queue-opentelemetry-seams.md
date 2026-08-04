# Laravel queue and OpenTelemetry integration seams

Research for [Research Laravel queue and OpenTelemetry integration seams](https://linear.app/nickwelsh/issue/NW-157/research-laravel-queue-and-opentelemetry-integration-seams). Sources checked 2026-08-04.

## Answer

Skyline can observe unchanged Laravel Jobs across standard runners by combining two framework seams:

1. `Queue::createPayloadUsing(...)` adds a namespaced Skyline carrier and identity to every normally-created payload.
2. Laravel queue events turn each delivery into an Attempt and settle its outcome.

Neither seam is sufficient alone. `JobQueued` confirms most asynchronous pushes, but `SyncQueue` never emits it and `DatabaseQueue::bulk()` bypasses it. Conversely, processing events do not exist until a worker receives the Job. Capturing every Run from dispatch therefore requires a provisional Run at payload creation, later confirmed by `JobQueued` where available or by `JobProcessing`; failed enqueue may leave a provisional record for pruning. Decorating individual queue drivers is the only alternative that avoids that tradeoff.

Use the payload `uuid` as Run identity. It remains in the same payload across releases and retries; `Job::attempts()` identifies each delivery. Create real OTel producer and consumer spans, but keep a Skyline-owned `TracerProvider` and exporter separate from the global provider. PHP and the OTel specification explicitly permit multiple providers. This prevents replacing the host provider and avoids requiring `ext-opentelemetry`.

## Capture contract

| Moment | Laravel seam | Skyline action |
| --- | --- | --- |
| Payload creation | `Queue::createPayloadUsing` | Read `uuid` / `displayName`; create a short `PRODUCER` span; inject its W3C `traceparent` / `tracestate` plus `run_id` and high-resolution creation time under a `skyline` key; provision the Run best-effort. |
| Successful push | `JobQueued` | Confirm queued state and exact enqueue time; record driver ID, connection, queue, and delay where exposed. |
| Delivery | `JobProcessing` | Extract Skyline carrier; create Attempt from `attempts()`; start a `CONSUMER` span parented to the producer span; mark Run running. |
| Normal return | `JobProcessed` | End Attempt completed unless `job->isReleased()` or `job->hasFailed()` says otherwise. |
| Manual release | `JobProcessed` plus `job->isReleased()` | End Attempt released; keep Run retrying. Laravel exposes no generic release event or release delay. |
| Exception | `JobExceptionOccurred` | Record exception and end Attempt failed. If `hasFailed()` is false, Run is retrying. |
| Automatic exception release | `JobReleasedAfterException` | Confirm retrying/released state. Do not depend on this event alone. |
| Final failure | `JobFailed` / `Queue::failing` | Mark Run failed. This event also covers manual `fail()`. |
| Timeout | `JobTimedOut` | End Attempt failed and use `JobFailed` if Laravel fails it; otherwise leave Run retrying. Hard worker death may emit nothing. |

Laravel documents `Queue::before`, `Queue::after`, and `Queue::failing`; `QueueManager` also exposes `exceptionOccurred` as a listener for `JobExceptionOccurred` ([queue docs](https://laravel.com/docs/13.x/queues#job-events), [manager source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/QueueManager.php#L57-L104)). The worker fires processing before max-attempt checks, processed after a normal return, exception on thrown failures, automatic-release after requeue, and `JobAttempted` in `finally` ([worker source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Worker.php#L539-L620)). Thus an Attempt can legitimately exist even when the Job handler never runs.

`Job::fail()` dispatches `JobFailed`; the base Job tracks `deleted`, `released`, and `failed` flags and exposes queue/name/payload accessors ([Job source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Jobs/Job.php#L105-L224), [name and queue source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Jobs/Job.php#L349-L400)). Event handling must be idempotent: terminal `JobFailed` can precede `JobExceptionOccurred`, and a manually-failed Job can still reach `JobProcessed`.

Every Skyline callback must catch `Throwable`, log, and return control. Laravel event listeners and payload callbacks run inline; allowing instrumentation exceptions to escape would violate the invariant that monitoring cannot change dispatch, retries, transactions, or outcomes. OTel likewise says span-processor start callbacks should not block or throw ([trace SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/#onstart)).

## Payload and dispatch coverage

Laravel object and string payloads contain a UUID and display name. Payload callbacks receive connection, queue, and the payload array, then merge returned keys into the envelope ([payload source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Queue.php#L123-L214), [hook source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Queue.php#L324-L347)). The hook runs before object serialization/encryption, so top-level Skyline metadata remains readable without inspecting the serialized Job or bindings.

Normal asynchronous `push` / `later` paths call `enqueueUsing`, which emits `JobQueueing` immediately before the backend operation and `JobQueued` only after it succeeds ([queue source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Queue.php#L360-L471)). With after-commit dispatch, those events wait for the transaction callback, but payload creation occurs earlier. Queue time should start at confirmed `JobQueued`; where confirmation is unavailable, Skyline's injected creation timestamp is an approximation.

Known dispatch gaps:

- `SyncQueue` creates a payload and fires processing / processed / exception events directly; it does not call `enqueueUsing`, so it emits neither `JobQueueing` nor `JobQueued` ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/SyncQueue.php#L155-L264)). Treat processing as confirmation and queue time as zero.
- `DatabaseQueue::bulk()` creates each payload and inserts all records directly, without queueing / queued events, in Laravel 10-13 ([13.x source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/DatabaseQueue.php#L304-L320)). Payload enrichment covers batch Jobs, but exact confirmation is unavailable until processing.
- Redis and pre-13 SQS bulk implementations call ordinary `push` / `later`; Laravel 13's native SQS batching explicitly emits per-message queueing / queued events ([13.x source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/SqsQueue.php#L319-L430)).
- `pushRaw()` bypasses Laravel payload creation. Arbitrary raw payloads and custom drivers that do not extend `Illuminate\Queue\Queue` and call its payload creation path cannot receive automatic Skyline identity/context.
- A package can clear all static payload callbacks with `Queue::createPayloadUsing(null)`. Skyline should register once during package boot and document this Laravel-wide escape hatch.

## Jobs, wrappers, chains, batches, sync, and after-response

The seam is envelope-based, not application-class-based, so it covers normal custom Jobs plus Laravel's wrappers:

- queued listeners use `CallQueuedListener`, whose display name is the listener class ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Events/CallQueuedListener.php#L120-L142));
- queued mail uses `SendQueuedMailable`, whose display name is the mailable class ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Mail/SendQueuedMailable.php#L79-L143));
- queued notifications use `SendQueuedNotifications`, whose display name is the notification class ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Notifications/SendQueuedNotifications.php#L120-L141));
- closures are converted to `CallQueuedClosure`, with a file/line display name ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/CallQueuedClosure.php#L14-L16));
- batch members are ordinary payloads sent through `bulk`; chains dispatch the next Job before the current Attempt's processed event ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/CallQueuedHandler.php#L196-L205)).

Keep the current Skyline Attempt context in a process-local registry from `JobProcessing` through its terminal event. A child Job's payload callback then creates its producer span as a child of that Attempt without any Job-code change. Chains naturally work because dispatch occurs before `JobProcessed`; batch additions and ordinary nested dispatches use the same rule.

`dispatchSync()` sends a normal `ShouldQueue` Job with `onConnection()` through the `sync` queue; generated Jobs and Laravel wrappers use the `Queueable` trait and therefore take this path ([dispatcher source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Bus/Dispatcher.php#L100-L108)). `dispatchAfterResponse()` calls `dispatchSync()` from the terminating callback ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Bus/Dispatcher.php#L308-L318)). Both therefore get SyncQueue lifecycle events and near-zero queue time. A custom `ShouldQueue` command lacking `onConnection()` falls through to `dispatchNow()` and has no queue events; this is not a standard generated Job shape.

## Runner compatibility boundary

Processing events are emitted by `Illuminate\Queue\Worker::process`, not by the Job contract. Supported runners must execute Jobs through Laravel's Worker or reproduce its standard events. `queue:work` and `queue:listen` do. Horizon subclasses Laravel's `WorkCommand` and receives the application `queue.worker`, so it shares the same lifecycle ([Horizon source](https://github.com/laravel/horizon/blob/2ebe3cb25ab6461b53a4e3ef42e167edeafe7932/src/Console/WorkCommand.php#L1-L8), [provider source](https://github.com/laravel/horizon/blob/2ebe3cb25ab6461b53a4e3ef42e167edeafe7932/src/HorizonServiceProvider.php#L160-L171)).

A third-party runner that pops a Job and invokes `fire()` itself bypasses the Worker events and is unsupported without an adapter. A custom queue driver may still be supported if it uses Laravel payload creation and returns a normal `Illuminate\Contracts\Queue\Job` to the Worker. This is the precise meaning of “any queue runner” for MVP.

## Retry and release limits

- The payload UUID is the stable logical Run key. The backend-specific Job object's `attempts()` is the 1-based Attempt number.
- A manual `$this->release($delay)` only sets the Job's released flag and delegates delay to the driver. There is no framework-wide manual-release event or delay getter. Skyline can classify Released at `JobProcessed`, but cannot reliably display the requested release delay.
- An unhandled exception fires `JobExceptionOccurred`; the Worker then auto-releases if the Job is not deleted, released, or failed, and emits `JobReleasedAfterException` ([source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Worker.php#L580-L621)).
- A timeout emits `JobTimedOut` only through Laravel's timeout handler. SIGKILL, OOM, host loss, and nonconforming runners can leave an Attempt running. This matches the MVP decision to defer orphan detection.

## SQL spans

Register a Laravel `QueryExecuted` listener. It contains parameterized SQL, bindings, elapsed milliseconds, connection, and connection name; Laravel explicitly documents `DB::listen` for every executed query ([database docs](https://laravel.com/docs/13.x/database#listening-for-query-events), [event source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Database/Events/QueryExecuted.php#L5-L87)). Persist `$query->sql`, never `$bindings` or `toRawSql()`. Backdate the OTel client span start from the event timestamp by `$query->time` milliseconds and parent it explicitly to the current Skyline Attempt.

The official OTel Laravel instrumentation uses exactly this listener and timing approach, mapping Laravel drivers to OTel database attributes ([QueryWatcher](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/78b6319ad06f4539bce1065d94d1ca7bdcab2bfb/src/Instrumentation/Laravel/src/Watchers/QueryWatcher.php#L20-L91)). Reuse its semantic-convention choices, not its extension-based hook runtime.

Limits:

- `QueryExecuted` is emitted after successful execution. Laravel calls `logQuery()` only after exception handling returns; a rethrown query failure has no event ([connection source](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Database/Connection.php#L799-L827)). MVP SQL spans therefore cover successful queries only.
- The event's duration includes Laravel's successful query call; it has no original start timestamp, so backdating from listener time is approximate.
- Skyline's own persistence queries would also emit `QueryExecuted`. Use a re-entrancy guard and ignore exporter writes (preferably a named Skyline connection) to prevent recursive spans.
- Listen only while an Attempt is active. Do not persist in the query callback; build/end the span and let the guarded exporter handle it, preserving application transaction behavior.

## OpenTelemetry provider and exporter design

Use official `open-telemetry/api`, `open-telemetry/context`, and `open-telemetry/sdk` packages. Build a Skyline-owned provider with an explicit `AlwaysOnSampler` and `SimpleSpanProcessor(SkylineSpanExporter)`, satisfying the no-sampling MVP requirement. The SDK builder accepts arbitrary processors; `SpanExporterInterface` provides `export`, `shutdown`, and `forceFlush` ([builder](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/SDK/Trace/TracerProviderBuilder.php#L13-L67), [exporter interface](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/SDK/Trace/SpanExporterInterface.php#L13-L31)). OTel permits arbitrary numbers of providers specifically for different processors/configuration ([Tracing API](https://opentelemetry.io/docs/specs/otel/trace/api/#tracerprovider)).

Do not replace or mutate `Globals::tracerProvider()`:

- `Globals` lazily runs registered initializers once, caches the result, and exposes no supported setter or “append processor” API ([Globals source](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/API/Globals.php#L25-L122)). Registering an initializer after first access has no effect until the internal test-only reset.
- The SDK `TracerProvider` is final; its processors are supplied at construction and held in private shared state. It exposes flush, shutdown, tracer access, and experimental instrumentation configuration, but no processor mutation ([provider source](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/SDK/Trace/TracerProvider.php#L24-L118)).
- Therefore Skyline cannot safely “attach” its exporter to an arbitrary already-built host provider. A host-built provider can opt in by adding Skyline's processor during construction; otherwise use the dedicated provider.

Do not activate Skyline spans in OTel's global current context in coexistence mode. Instead, retain their `ContextInterface` in Skyline's Attempt registry, call `setParent($context)` for child spans, and pass that context explicitly to `TraceContextPropagator::inject`. The PHP API supports explicit parent contexts and explicit propagation contexts ([span builder](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/API/Trace/SpanBuilderInterface.php#L15-L50), [propagator](https://github.com/open-telemetry/opentelemetry-php/blob/c948c8fe4eff3c6264f02b6a92e8b44f577ef2d5/src/API/Trace/Propagation/TraceContextPropagator.php#L58-L105)). This prevents host auto-instrumentation from accidentally parenting its spans under a Skyline-only parent that its exporter never receives.

For the first Skyline Run, start an isolated Skyline trace and optionally link the ambient host span. For child Runs, parent the producer span to the current Skyline Attempt. Inject the producer context into the namespaced carrier; each delivery creates a consumer Attempt span from it. This follows OTel messaging's permitted producer/consumer parent or link model while guaranteeing Skyline stores a complete causal Job trace ([messaging conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/#context-propagation)). A logical Run remains Skyline's aggregate over one producer and one-or-more Attempt spans; do not keep one mutable OTel span open across processes/retries.

The official OTel Laravel auto-instrumentation already hooks queue payloads, Worker processing, SyncQueue, and SQL, but requires `ext-opentelemetry` and uses the global provider ([package requirements](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/78b6319ad06f4539bce1065d94d1ca7bdcab2bfb/src/Instrumentation/Laravel/composer.json#L16-L31), [queue hook](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/78b6319ad06f4539bce1065d94d1ca7bdcab2bfb/src/Instrumentation/Laravel/src/Hooks/Illuminate/Queue/Worker.php#L29-L187)). Skyline should not depend on it. If present, the dedicated, non-activated Skyline provider avoids replacing its provider and keeps each backend to one copy of its own spans.

## Version-specific gaps

| Laravel | Relevant differences |
| --- | --- |
| 10.x | Core processing / failure / timeout events and payload hook exist. `JobQueueing` / `JobQueued` omit queue and delay. No `JobAttempted`. No payload `createdAt` or top-level delay. `QueryExecuted` lacks `toRawSql()` (irrelevant because Skyline must not interpolate bindings). |
| 11.x | Queueing / queued events add queue and delay. `JobAttempted` exists for Worker deliveries, but SyncQueue does not emit it. `QueryExecuted::toRawSql()` appears. |
| 12.x | SyncQueue emits `JobAttempted`. Payload adds second-resolution `createdAt`, top-level delay, and batch ID. `QueryExecuted` adds read/write type. |
| 13.x | `JobAttempted` carries the actual exception instead of a boolean; `JobReleasedAfterException` adds backoff and exception. Native SQS bulk emits per-message queued events. Query read/write type adds `direct`. |

Evidence: [10.x events and queue](https://github.com/laravel/framework/tree/3ff39b7a9b83e633383ec9b019827ed54b6d38bc/src/Illuminate/Queue), [11.x Worker](https://github.com/laravel/framework/blob/c0f062fa350ec3bb616740b74692357624cdd057/src/Illuminate/Queue/Worker.php#L441-L518), [12.x SyncQueue](https://github.com/laravel/framework/blob/01fd8c8b8debbf6801aedbdf4800948968bd91fc/src/Illuminate/Queue/SyncQueue.php#L124-L208), [13.x attempt event](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Events/JobAttempted.php#L5-L29), [13.x release event](https://github.com/laravel/framework/blob/51173d2f7bc3823782ea0217a3542a19aa10c068/src/Illuminate/Queue/Events/JobReleasedAfterException.php#L5-L18).

Use feature detection for optional event fields/classes, not `app()->version()` branches. The stable MVP floor can be chosen separately; the integration is implementable on Laravel 10-13 with the fallbacks above.
