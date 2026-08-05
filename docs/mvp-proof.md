# MVP proof and operations

## Supported matrix

Skyline supports Laravel 12 on PHP 8.2–8.5 and Laravel 13 on PHP 8.3–8.5. CI runs the complete package suite at every combination. The persistence compatibility test also runs against SQLite, MySQL 8.4, MariaDB 11.8, and PostgreSQL 17.

Queue capture requires the standard Laravel worker lifecycle. `queue:work`, the database queue, and the sync runner are exercised. A third-party runner must emit Laravel's ordinary queue events to be compatible.

## Install

Install the package, then publish and run its migrations before queued work is processed:

```sh
composer require nickwelsh/skyline
php artisan vendor:publish --tag=skyline-migrations
php artisan migrate
```

Skyline serves compiled assets from the package at `/skyline`; production applications do not need Node.js.

Local requests are authorized by default. Every non-local application must define the `viewSkyline` Gate. Treat the dashboard and JSON API as privileged operational data and do not expose them publicly.

```php
Gate::define('viewSkyline', fn (User $user): bool => $user->isOperator());
```

## Reproduce the complete fixture

The fixture is a Composer-only Laravel application linked to the working package. It contains unchanged successful, parent/child, retrying, and terminally failing Jobs with ordinary application SQL.

```sh
composer fixture:install
composer fixture:prove
```

The proof recreates only `fixtures/laravel/database/database.sqlite`, publishes and runs Skyline's migrations, drains Jobs through `queue:work`, and verifies:

- Laravel outcomes remain successful, retry-to-success, or terminal failure as expected;
- every Run and Attempt is persisted, including the parent-to-child Trace;
- application SQL is captured with placeholders and without bindings;
- `/skyline`, the Run list API, and every Run detail return successfully;
- pruning removes one complete expired terminal Trace and retains current Traces;
- fixture Job source contains no Skyline or OpenTelemetry calls.

For another supported database, set Laravel's normal `DB_*` variables before running the proof. The external database must exist and is recreated by `migrate:fresh`, so use a disposable fixture database only.

## Overhead release gate

Run the production package path against the approved guardrail:

```sh
composer fixture:benchmark
```

This runs seven alternating baseline/Skyline trials of 100 database-queued Jobs for no-op, ten-query, and representative CPU-plus-three-query workloads. It fails when median added time exceeds `0.8ms + 0.1ms per captured SQL span`, or when relative overhead exceeds 10% for a baseline of at least 10ms. Run it per supported SQL engine before release. A failure blocks release; it must never enable sampling or exclude eligible Runs.

The harness disables Xdebug for measured child processes. Debugger/developer hooks materially distort instrumentation-heavy microbenchmarks and are not representative of production workers.

## Security, privacy, and operations

- Skyline never stores Job payloads. SQL bindings and result previews are disabled by default; parameterized queries otherwise retain placeholders. `SKYLINE_SQL_CAPTURE_BINDINGS`, `SKYLINE_SQL_CAPTURE_RESULTS`, and the broader `SKYLINE_CAPTURE_ALL` switch deliberately cross that privacy boundary and should remain disabled in production unless approved. Sensitive configured column names are redacted, but applications must still treat enabled capture as sensitive data. Literal values already embedded in raw SQL remain part of the SQL text, so applications must parameterize sensitive values.
- Result previews are bounded to 25 rows and 64KB by default. Write queries record affected-row counts. Cursor and streamed results are never consumed. A connection with a custom PDO statement class is left untouched and logs a warning instead of capturing results.
- SQL source capture is disabled by default. `SKYLINE_SQL_CAPTURE_SOURCE=true` stores one application file path and line number per query without arguments or a full stack. Configure `SKYLINE_EDITOR` and optional `SKYLINE_EDITOR_BASE_PATH` for editor links.
- Capture is never sampled. Records flush in transactional batches after 5,000 operations, after a two-second worker-loop delay, or at normal process termination. Live queued/running state can therefore lag, and a hard kill can lose the unflushed window.
- Exception class, message, relative frames, and bounded metadata are visible to authorized operators. Avoid secrets in exception messages.
- Expanded exception traces can expose application source snippets to authorized operators. Snippets are read on demand, limited to the failing lines, and never persisted. Keep the `viewSkyline` Gate restricted accordingly.
- Storage defaults to an isolated clone of the default connection. Set `SKYLINE_DB_CONNECTION` for a dedicated configured connection.
- Retention defaults to 24 hours. Set `SKYLINE_RETENTION_HOURS`, run `php artisan skyline:prune` manually when needed, and keep Laravel's scheduler running for daily pruning.
- Pruning only deletes terminal Traces older than the cutoff. It deletes each Trace as a unit and leaves active Traces intact.
- Set `SKYLINE_ENABLED=false` to disable new telemetry capture without removing the interface or stored data.
- Tune `SKYLINE_BATCH_MAX_OPERATIONS` and `SKYLINE_BATCH_MAX_DELAY_MS` only after rerunning the overhead gate. Lower values improve live-state freshness at the cost of Job throughput.
- Monitoring failures are rate-limited in the application log and cannot change Job outcomes. Alert on `Skyline persistence failed` and `Skyline telemetry capture failed` warnings.
- Back up Skyline tables only if historical telemetry is operationally valuable; they are derived monitoring data, not application state.
