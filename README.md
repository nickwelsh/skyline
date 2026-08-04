# Skyline

Queue monitoring for Laravel.

## Development

```sh
composer install
composer test
composer fixture:install
```

The package serves its precompiled interface at `/skyline`. Local requests are authorized automatically. Define the `viewSkyline` gate in the host application to authorize other environments.

## License

Apache-2.0. See [LICENSE](LICENSE).
