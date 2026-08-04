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
