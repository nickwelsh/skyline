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

Laravel cache reads, writes, deletes, flushes, and lock flushes are captured as Attempt child spans. Direct Redis commands are captured separately; Redis commands backing a high-level cache operation are suppressed. Values and Redis parameters are never captured. Cache keys are hashed by default. Short-lived raw key and source capture are independent opt-ins:

```dotenv
SKYLINE_CACHE_CAPTURE_KEYS=true
SKYLINE_CACHE_CAPTURE_SOURCE=true
```

Laravel does not emit lifecycle events for increment/decrement or individual lock acquire/release operations, so those remain visible only as direct Redis commands when applicable. Set `SKYLINE_CACHE_ENABLED=false` to disable cache and Redis spans.

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

Laravel mail and notification delivery is captured automatically for synchronous and queued work. Mail records mailable class, mailer, recipient count, duration, and outcome. Notifications produce one span per channel and recipient. Addresses, subjects, rendered bodies, attachments, routes, responses, and payloads are never captured. Set `SKYLINE_DELIVERY_CAPTURE_SOURCE=true` for bounded application source locations or `SKYLINE_DELIVERY_ENABLED=false` to disable delivery spans. Laravel mail does not emit a failure event, so a send started without a matching sent event is marked incomplete when its Attempt ends.

Laravel Storage disks record reads, writes, deletes, copies, moves, streams, and metadata operations. Contents are never inspected for telemetry, and streams retain their original position and ownership. Paths are hashed by default; bounded raw paths and source locations require `SKYLINE_STORAGE_CAPTURE_PATHS=true` and `SKYLINE_STORAGE_CAPTURE_SOURCE=true` respectively.

Laravel Process records synchronous and asynchronous execution duration, executable basename, timeout, exit code, and outcome. Arguments, environment, input, stdout, and stderr are never captured or consumed. Source capture requires `SKYLINE_PROCESS_CAPTURE_SOURCE=true`. Process fakes use the same wrapper. Direct Symfony Process instances cannot be intercepted safely; wrap those calls in `Skyline::measure()` when they need a domain span.

Attempt Overview reconciles child-span counts and cumulative durations by type and shows measured peak memory, memory delta, and CPU time. Warning-and-higher log breadcrumbs are available as an explicit opt-in:

```dotenv
SKYLINE_LOGGING_ENABLED=true
```

Breadcrumbs store timestamp, level, the effective default channel, a bounded message, and allowlisted scalar context (`code` and `status` by default). Debug/info are excluded by default. Common secret assignments and bearer tokens are redacted; exceptions, arbitrary objects, structured payloads, and non-allowlisted context are discarded. Configure `logging.levels`, `logging.context_allowlist`, and `SKYLINE_LOGGING_MAX_MESSAGE_BYTES` in the published config.

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

## License

Apache-2.0. See [LICENSE](LICENSE).
