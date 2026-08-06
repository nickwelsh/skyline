# Skyline

Queue monitoring for Laravel.

## Development

```sh
composer install
composer test
composer fixture:install
composer fixture:prove
composer fixture:benchmark
```

The package serves its precompiled interface at `/skyline`. Local requests are authorized automatically. Define the `viewSkyline` gate in the host application to authorize other environments.

Consumer applications do not need Node.js or a frontend build. Skyline ships fingerprinted JavaScript, CSS, and fonts in `dist/`.

Publish and run Skyline's migrations before processing queued work:

```sh
php artisan vendor:publish --tag=skyline-migrations
php artisan migrate
```

Telemetry uses an isolated clone of the default database connection. Set `SKYLINE_DB_CONNECTION` to choose another configured connection. Retention defaults to 24 hours; `skyline:prune` runs daily and is also available manually.

Set `SKYLINE_ENABLED=false` to stop capture while keeping the dashboard, API, migrations, and commands available.

Optional capture remains off by default. Enable every optional capture in development with one switch:

```dotenv
SKYLINE_CAPTURE_ALL=true
```

Every individual capture environment variable inherits this value and can still override it. For example, `SKYLINE_HTTP_CAPTURE_REQUEST_BODY=false` keeps request bodies off while the shared switch enables everything else. The shared switch includes SQL bindings/results, HTTP query/headers/bodies, raw cache keys and values, Redis arguments, delivery recipients/content, storage paths/contents, process command/environment/input/output, source locations, and log breadcrumbs; keep it disabled in production unless all captured data is approved.

Skyline captures every eligible Run and flushes normalized telemetry in bounded batches. Defaults are 5,000 operations or two seconds at a worker-loop boundary; configure `SKYLINE_BATCH_MAX_OPERATIONS` and `SKYLINE_BATCH_MAX_DELAY_MS` when needed.

SQL bindings and outputs are sensitive and disabled by default. Enable either independently for short-lived debugging:

```dotenv
SKYLINE_SQL_CAPTURE_BINDINGS=true
SKYLINE_SQL_CAPTURE_RESULTS=true
SKYLINE_SQL_CAPTURE_SOURCE=true
```

Result capture stores a redacted preview of up to 25 returned rows or the affected-row count for writes, bounded to 64KB per query. It never consumes cursors or streams. Configure `SKYLINE_SQL_MAX_BINDING_BYTES`, `SKYLINE_SQL_MAX_RESULT_ROWS`, `SKYLINE_SQL_MAX_RESULT_BYTES`, and `sql.redact_columns` in the published Skyline config. Leave optional capture disabled in production unless its data is explicitly approved.

Source capture stores the first application `file:line` frame for each query. Set `SKYLINE_EDITOR` to `cursor`, `phpstorm`, `vscode`, or `zed` for clickable links. In containers, set `SKYLINE_EDITOR_BASE_PATH` to the matching local project path. Skyline also honors Laravel's `app.editor` string or array configuration, including custom `href` templates.

Outgoing Laravel HTTP requests are captured automatically as Attempt child spans. Direct Guzzle clients can use the same middleware without replacing Guzzle's default stack:

```php
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use NickWelsh\Skyline\Telemetry\OutgoingHttpInstrumentation;

$stack = HandlerStack::create();
$stack->push(app(OutgoingHttpInstrumentation::class), 'skyline');

$client = new Client(['handler' => $stack]);
```

Saloon's default Guzzle sender uses the same integration. Add it once in a connector constructor:

```php
$this->sender()->getHandlerStack()->push(
    app(OutgoingHttpInstrumentation::class)->forClient('saloon'),
    'skyline',
);
```

Method, bounded URL, status, and duration are captured by default. Query names remain visible but values are redacted. Headers, bodies, raw query values, and source are independent opt-ins:

```dotenv
SKYLINE_HTTP_CAPTURE_REQUEST_HEADERS=true
SKYLINE_HTTP_CAPTURE_REQUEST_BODY=true
SKYLINE_HTTP_CAPTURE_RESPONSE_HEADERS=true
SKYLINE_HTTP_CAPTURE_RESPONSE_BODY=true
SKYLINE_HTTP_CAPTURE_SOURCE=true
```

Only allowlisted headers and redacted sensitive headers are stored. Body previews accept bounded seekable text, JSON, XML, form, and GraphQL content; configured sensitive JSON fields are redacted. Configure allowlists, redaction fields, and byte limits in the published config. Set `SKYLINE_HTTP_ENABLED=false` to disable all outgoing HTTP spans.

Failed Attempts show a collapsed Laravel-style exception preview. Expanding it reveals highlighted application source, folded vendor frames, and editor links. Copy as Markdown produces a bounded exception report suitable for issues or debugging. Source is read on demand from the host filesystem and is not persisted by Skyline.

Laravel cache reads, writes, deletes, flushes, and lock flushes are captured as Attempt child spans. Direct Redis commands are captured separately; Redis commands backing a high-level cache operation are suppressed. Cache keys are hashed and values are omitted by default. Short-lived raw key, value, and source capture are independent opt-ins:

```dotenv
SKYLINE_CACHE_CAPTURE_KEYS=true
SKYLINE_CACHE_CAPTURE_VALUES=true
SKYLINE_CACHE_CAPTURE_SOURCE=true
```

Value previews retain scalar and structured types, are bounded to 64KB, and apply to writes and successful reads. Configure `SKYLINE_CACHE_MAX_VALUE_BYTES` to change the bound. Direct Redis arguments are separately available with `SKYLINE_REDIS_CAPTURE_ARGUMENTS=true` and bounded by `SKYLINE_REDIS_MAX_ARGUMENT_BYTES`; Laravel's Redis events do not expose command return values. Laravel also does not emit cache lifecycle events for increment/decrement or individual lock acquire/release operations, so those remain visible only as direct Redis commands when applicable. Set `SKYLINE_CACHE_ENABLED=false` to disable cache and Redis spans.

Applications can add domain-specific spans and events to the active Attempt:

```php
use NickWelsh\Skyline\Facades\Skyline;

$pdf = Skyline::measure('Generate PDF', fn () => $generator->render(), [
    'template' => 'receipt',
]);

Skyline::event('Imported chunk', ['rows' => 500]);
```

`measure()` supports synchronous values and Guzzle promises, preserves resolved values and failures, and nests spans created by synchronous callbacks. Both APIs safely no-op outside an active Attempt or when `SKYLINE_CUSTOM_ENABLED=false`. Attribute names and scalar values are bounded; arrays, objects, resources, and null are stored only as type summaries. Callable arguments and return values are never captured.

Laravel database transactions are captured automatically. Nested transactions bracket their SQL children and record connection, depth, outcome, total duration, and cumulative query time. Rollbacks are marked as failed transaction nodes without failing a successful Attempt that catches the rollback. Locking clauses are identified on captured SQL spans. Laravel's transaction events do not expose callback exceptions, retry numbers, or driver lock-wait timing, so Skyline records those only when they are independently available from SQL/Attempt telemetry and never guesses them.

Laravel mail and notification delivery is captured automatically for synchronous and queued work. Mail records mailable class, mailer, recipient count, duration, and outcome. Notifications produce one span per channel and recipient. Sensitive detail is omitted by default. Enable it briefly for debugging:

```dotenv
SKYLINE_DELIVERY_CAPTURE_RECIPIENTS=true
SKYLINE_DELIVERY_CAPTURE_CONTENT=true
SKYLINE_DELIVERY_CAPTURE_SOURCE=true
```

Recipient capture stores mail addresses and a best-effort notification notifiable identity. Content capture stores bounded rendered mail subjects/text/HTML, notification public data, and channel response or failure data exposed by Laravel. The inspector shows HTML as a sandboxed render by default with its source available alongside it. It does not render notifications a second time, and attachments remain excluded. Configure `SKYLINE_DELIVERY_MAX_CONTENT_BYTES` to change the 64KB bound. Set `SKYLINE_DELIVERY_ENABLED=false` to disable delivery spans. Laravel mail does not emit a failure event, so a send started without a matching sent event is marked incomplete when its Attempt ends.

Laravel Storage disks record reads, writes, deletes, copies, moves, streams, and metadata operations. Paths are hashed and contents are omitted by default. Enable bounded content previews with `SKYLINE_STORAGE_CAPTURE_CONTENTS=true`; string reads/writes and seekable streams are captured without changing the stream position or ownership. Streams that cannot be inspected safely remain unavailable. Bounded raw paths and source locations require `SKYLINE_STORAGE_CAPTURE_PATHS=true` and `SKYLINE_STORAGE_CAPTURE_SOURCE=true` respectively. Configure `SKYLINE_STORAGE_MAX_CONTENT_BYTES` to change the 64KB content bound. With path capture enabled, local disks offer editor links and disks with a `url` offer public links. For disks needing an explicit mapping, configure `skyline.storage.links.<disk>` as a base URL or a template containing `{path}`.

Laravel Process records synchronous and asynchronous execution duration, executable basename, timeout, exit code, and outcome. Command/arguments, configured environment, input, and stdout/stderr are sensitive and omitted by default; enable them independently with `SKYLINE_PROCESS_CAPTURE_COMMAND`, `SKYLINE_PROCESS_CAPTURE_ENVIRONMENT`, `SKYLINE_PROCESS_CAPTURE_INPUT`, and `SKYLINE_PROCESS_CAPTURE_OUTPUT`. Captures are bounded to 64KB by `SKYLINE_PROCESS_MAX_CONTENT_BYTES`; seekable input streams retain their position. Source capture requires `SKYLINE_PROCESS_CAPTURE_SOURCE=true`. Process fakes use the same wrapper. Symfony Process instances can use `Skyline::process($process)` to preserve `Process::run()` behavior while recording the same bounded process span; instances constructed and run entirely outside Skyline cannot be intercepted safely.

Attempt Overview reconciles child-span counts and cumulative durations by type and shows PHP's measured process-lifetime peak memory, Attempt boundary memory delta, and Attempt CPU time. Warning-and-higher log breadcrumbs are available as an explicit opt-in:

```dotenv
SKYLINE_LOGGING_ENABLED=true
```

Breadcrumbs store timestamp, level, a configured channel label, a bounded message, and allowlisted scalar context (`code` and `status` by default). Capture is bounded to 100 breadcrumbs per Attempt by default. Laravel's log event does not expose its originating channel, so Skyline records `SKYLINE_LOGGING_CHANNEL` or the configured default channel rather than guessing. Debug/info are excluded by default. Common secret assignments and bearer tokens are redacted; exceptions, arbitrary objects, structured payloads, and non-allowlisted context are discarded. Configure `logging.levels`, `logging.context_allowlist`, `SKYLINE_LOGGING_CHANNEL`, `SKYLINE_LOGGING_MAX_BREADCRUMBS`, and `SKYLINE_LOGGING_MAX_MESSAGE_BYTES` in the published config.

See [MVP proof and operations](docs/mvp-proof.md) for the reproducible clean-app proof, supported runtime/database matrix, authorization and privacy requirements, retention operations, and release checks.

### Interface development

Requires Node.js 24.18.0 and pnpm 10.33.2.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm test
corepack pnpm test:browser
```

Trigger.dev-derived source is pinned and mapped in `resources/js/trigger/import-manifest.json`. Verify it with `corepack pnpm trigger:check`; refresh exact mapped files with `corepack pnpm trigger:import -- --source /path/to/trigger.dev`.

The fidelity oracle compares the packaged Skyline UI with its exact pinned Trigger reference. Verify committed proofs with `corepack pnpm oracle:check`. Run the paired browser suite only in its pinned Linux toolchain:

```sh
docker build --platform linux/amd64 -f tests/fidelity/Dockerfile -t skyline-fidelity-oracle .
docker run --rm --platform linux/amd64 --ipc=host \
  -e CI=1 \
  -e SKYLINE_ORACLE_IMAGE='mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d' \
  -v "$PWD:/work" \
  -v skyline-fidelity-node-modules:/work/node_modules \
  skyline-fidelity-oracle \
  bash -lc 'pnpm install --frozen-lockfile && pnpm build && pnpm oracle:reference:check && pnpm oracle:test'
```

Oracle regeneration is a review decision, not an automatic screenshot update. Change the pinned upstream/environment or `allowed-differences.json`, run the same container with `SKYLINE_ORACLE_RECORD=1`, then run `pnpm oracle:record -- --decision NW-216` inside it. Commit the changed inputs, every proof artifact, and `bundle.json` together.

For final review, assemble the source-fidelity handoff only after the committed oracle verifies: `pnpm handoff:record -- --decision NW-228`. Commit `tests/fidelity/handoff.json` with the proof, then use `pnpm handoff:check` to reject missing or stale handoff evidence. See [source-fidelity handoff](docs/source-fidelity-handoff.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
