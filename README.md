# Skyline

Queue monitoring for Laravel.

## Development

```sh
composer install
composer test
composer fixture:install
```

The package serves its precompiled interface at `/skyline`. Local requests are authorized automatically. Define the `viewSkyline` gate in the host application to authorize other environments.

Consumer applications do not need Node.js or a frontend build. Skyline ships fingerprinted JavaScript, CSS, and fonts in `dist/`.

Publish and run Skyline's migrations before processing queued work:

```sh
php artisan vendor:publish --tag=skyline-migrations
php artisan migrate
```

Telemetry uses an isolated clone of the default database connection. Set `SKYLINE_DB_CONNECTION` to choose another configured connection. Retention defaults to 24 hours; `skyline:prune` runs daily and is also available manually.

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
