# Runtime support matrix research

Snapshot: 2026-08-04. This records compatibility facts for later product decisions; it does not choose Skyline's support promise.

## Answer

The currently maintained framework surface is Laravel 12 and 13. Laravel 12 supports PHP 8.2-8.5 and receives security fixes through 2027-02-24; Laravel 13 supports PHP 8.3-8.5 and receives security fixes through 2028-03-17. Laravel 11's security support ended 2026-03-12. [Laravel support policy](https://laravel.com/docs/13.x/releases#support-policy)

All maintained Laravel/PHP combinations overlap the stable OpenTelemetry PHP API and SDK, whose current releases require PHP `^8.1`. The optional official Laravel auto-instrumentation also declares Laravel 12 and 13 compatibility, but it requires `ext-opentelemetry`. The optional PDO auto-instrumentation requires PHP `^8.2`, `ext-pdo`, and `ext-opentelemetry`. Manual spans through the API/SDK do not declare the extension. [API 1.10.0 metadata](https://packagist.org/packages/open-telemetry/api#1.10.0), [SDK 1.15.0 metadata](https://packagist.org/packages/open-telemetry/sdk#1.15.0), [Laravel auto-instrumentation 1.8.0 metadata](https://packagist.org/packages/open-telemetry/opentelemetry-auto-laravel#1.8.0), [PDO auto-instrumentation 0.5.0 metadata](https://packagist.org/packages/open-telemetry/opentelemetry-auto-pdo#0.5.0)

## Maintained runtime combinations

PHP itself currently supports 8.2, 8.3, 8.4, and 8.5. PHP 8.2 and 8.3 receive security fixes only; PHP 8.4 and 8.5 remain in active support. [PHP supported versions](https://www.php.net/supported-versions.php)

| Laravel | Framework maintenance on 2026-08-04 | PHP 8.2 | PHP 8.3 | PHP 8.4 | PHP 8.5 |
| --- | --- | --- | --- | --- | --- |
| 12 | Bug fixes until 2026-08-13; security until 2027-02-24 | Framework-supported; PHP security-only | Framework-supported; PHP security-only | Framework- and PHP-active | Framework- and PHP-active |
| 13 | Bug fixes through Q3 2027; security until 2028-03-17 | Not supported by framework | Framework-supported; PHP security-only | Framework- and PHP-active | Framework- and PHP-active |

The framework Composer metadata matches the policy: Laravel 12 requires PHP `^8.2`, while Laravel 13 requires `^8.3`. Both require Composer Runtime API `^2.2`. [Laravel 12 `composer.json`](https://github.com/laravel/framework/blob/12.x/composer.json), [Laravel 13 `composer.json`](https://github.com/laravel/framework/blob/13.x/composer.json)

Laravel 13 permits Symfony `^7.4 || ^8.0`. Symfony 7.4 supports PHP 8.2+, while Symfony 8 requires PHP 8.4+. A dependency resolution intended to remain runnable on PHP 8.3 therefore has to resolve the Symfony 7.4 line; resolving dependencies as though the platform were PHP 8.4+ can select artifacts that will not run on PHP 8.3. [Laravel 13 metadata](https://github.com/laravel/framework/blob/13.x/composer.json), [Symfony Console 7.4 metadata](https://github.com/symfony/console/blob/7.4/composer.json), [Symfony Console 8.0 metadata](https://github.com/symfony/console/blob/8.0/composer.json)

## Laravel queue and database seams

Laravel 12 and 13 expose the same core dispatch seams needed by an unchanged job: a queue payload callback (`Queue::createPayloadUsing`) and `JobQueueing` / `JobQueued` events around the connector enqueue operation. Their payloads include a UUID, display name, command class, and `createdAt`. [Laravel 12 `Queue`](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Queue/Queue.php), [Laravel 13 `Queue`](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Queue/Queue.php)

Both workers dispatch `JobProcessing`, `JobProcessed`, `JobExceptionOccurred`, `JobAttempted`, `JobReleasedAfterException`, and `JobTimedOut`. Laravel documents `Queue::before` and `Queue::after` as dashboard/statistics hooks. These are framework seams, not a guarantee that an alternate runner emits them: a runner must execute through, or reproduce, Laravel's standard worker lifecycle for event-only monitoring to observe it. [Laravel 12 worker source](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Queue/Worker.php), [Laravel 13 worker source](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Queue/Worker.php), [Laravel 13 job events](https://laravel.com/docs/13.x/queues#job-events)

Laravel 12 and 13 also provide `DB::listen`, whose `QueryExecuted` event exposes SQL, bindings, elapsed milliseconds, and the connection. The connection emits it after the query returns successfully. If query execution ultimately throws, control leaves before `logQuery`, so no `QueryExecuted` event is emitted for that failed statement. Native listening therefore covers successful Laravel database queries without an OTel extension, but cannot alone create a complete pre/post span for failed SQL. [Laravel database event docs](https://laravel.com/docs/13.x/database#listening-for-query-events), [Laravel 12 connection source](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Database/Connection.php), [Laravel 13 connection source](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Database/Connection.php)

## OpenTelemetry package constraints

Current stable package facts:

| Package | Current stable | PHP / extension constraint | Relevant dependency constraint |
| --- | --- | --- | --- |
| `open-telemetry/api` | 1.10.0 | PHP `^8.1` | Conflicts with `open-telemetry/sdk <=1.11` |
| `open-telemetry/sdk` | 1.15.0 | PHP `^8.1`, `ext-json` | Requires API `^1.8`, PSR-18 client and PSR-17 factory implementations |
| `open-telemetry/opentelemetry-auto-laravel` | 1.8.0 | PHP `^8.1`, `ext-json`, `ext-opentelemetry` | Declares Laravel `^6` through `^13`; API `^1.8` |
| `open-telemetry/opentelemetry-auto-pdo` | 0.5.0 | PHP `^8.2`, `ext-pdo`, `ext-opentelemetry` | API `^1.0`, semantic conventions `^1.36` |
| `open-telemetry/ext-opentelemetry` | 1.4.0 | PHP `^8.0` | Built-in/internal PHP methods are observable on PHP 8.2+ |

Sources: [API](https://packagist.org/packages/open-telemetry/api#1.10.0), [SDK](https://packagist.org/packages/open-telemetry/sdk#1.15.0), [Laravel instrumentation](https://packagist.org/packages/open-telemetry/opentelemetry-auto-laravel#1.8.0), [PDO instrumentation](https://packagist.org/packages/open-telemetry/opentelemetry-auto-pdo#0.5.0), [extension](https://packagist.org/packages/open-telemetry/ext-opentelemetry#1.4.0)

The API/SDK pairing needs an explicit compatible floor: API 1.10.0 cannot coexist with SDK 1.11 or older. The SDK's PSR implementation requirements are already satisfiable in a normal Laravel 12/13 dependency graph: Laravel requires Guzzle 7, Guzzle provides `psr/http-client-implementation`, and `guzzlehttp/psr7` provides `psr/http-factory-implementation`. [Laravel 12 metadata](https://github.com/laravel/framework/blob/12.x/composer.json), [Laravel 13 metadata](https://github.com/laravel/framework/blob/13.x/composer.json), [Guzzle 7 metadata](https://github.com/guzzle/guzzle/blob/7.10/composer.json), [Guzzle PSR-7 metadata](https://github.com/guzzle/psr7/blob/2.8/composer.json)

The extension is not required to create real spans manually. It enables runtime pre/post hooks used by official auto-instrumentation packages. Its documented caveats include extension conflicts, hooks needing registration before the first observed call, and a single-hook restriction for attribute hooks. [OpenTelemetry extension metadata and README](https://packagist.org/packages/open-telemetry/ext-opentelemetry#1.4.0)

## Database constraints

Laravel 12 and 13 document first-party support for MariaDB 10.3+, MySQL 5.7+, PostgreSQL 10+, SQLite 3.26+, and SQL Server 2017+. The SQL storage candidates already under discussion—SQLite, MariaDB/MySQL, and PostgreSQL—are all within that first-party surface. Driver-specific PHP extensions remain host requirements; Laravel lists `ext-pdo` as required for all database features. [Laravel 13 database support](https://laravel.com/docs/13.x/database#introduction), [Laravel 13 package suggestions](https://github.com/laravel/framework/blob/13.x/composer.json)

The official PDO auto-instrumentation works at `PDO` / `PDOStatement` method level and requires both `ext-pdo` and `ext-opentelemetry`. Its optional database context propagation is limited to `pdo_mysql` and `pdo_pgsql`, and only `PDO::query` and `PDO::exec`; that limitation does not apply to span creation itself. [PDO instrumentation README](https://packagist.org/packages/open-telemetry/opentelemetry-auto-pdo#0.5.0)

## Frontend build constraints

Trigger.dev's repository is a private pnpm workspace, not a published drop-in webapp package. At this snapshot, root metadata pins pnpm 10.33.2, `.nvmrc` pins Node 24.18.0, and the webapp build uses Remix/Vite plus separate Node server and worker builds. The webapp depends on many internal `workspace:*` packages. Rebuilding code copied directly from the current monorepo therefore requires its pinned toolchain or an intentionally isolated dependency graph; consuming a precompiled Skyline asset does not impose Node on a host Laravel application's runtime. [Trigger.dev root metadata](https://github.com/triggerdotdev/trigger.dev/blob/main/package.json), [Trigger.dev `.nvmrc`](https://github.com/triggerdotdev/trigger.dev/blob/main/.nvmrc), [Trigger.dev webapp metadata](https://github.com/triggerdotdev/trigger.dev/blob/main/apps/webapp/package.json)

Exact UI component and license-boundary findings belong to the separate Trigger.dev UI audit; this section records runtime/build compatibility only.

## Decision inputs left open

- Whether Skyline promises Laravel 12 and 13 or narrows to one remains a product decision.
- Whether PHP versions in security-only support are included remains a product decision.
- Whether to use native Laravel events, extension-based auto-instrumentation, or a hybrid remains an architecture decision. The extension path adds installation and conflict constraints; the native SQL path misses failed-query post events.
- Which database/version combinations receive CI coverage remains a product decision within Laravel's documented first-party surface.
- The frontend dependency extraction and pinned Trigger.dev snapshot remain separate decisions.
