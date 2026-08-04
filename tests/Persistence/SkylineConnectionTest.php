<?php

use Illuminate\Database\DatabaseManager;
use NickWelsh\Skyline\Persistence\SkylineConnection;

it('shares only an in-memory SQLite PDO', function (): void {
    /** @var DatabaseManager $database */
    $database = app('db');
    $connection = new SkylineConnection($database, config());

    expect($connection->get()->getPdo())->toBe($database->connection('testing')->getPdo())
        ->and($connection->owns('testing'))->toBeFalse();
});

it('clones a configured file database into the guarded Skyline connection', function (): void {
    $path = tempnam(sys_get_temp_dir(), 'skyline-connection-');
    config()->set('database.connections.skyline_source', [
        'driver' => 'sqlite',
        'database' => $path,
        'prefix' => '',
        'foreign_key_constraints' => true,
    ]);
    config()->set('skyline.connection', 'skyline_source');
    config()->set('skyline.storage_connection_name', 'skyline_isolated');
    /** @var DatabaseManager $database */
    $database = app('db');
    $connection = new SkylineConnection($database, config());

    expect($connection->get()->getPdo())->not->toBe($database->connection('skyline_source')->getPdo())
        ->and($connection->owns('skyline_isolated'))->toBeTrue()
        ->and($connection->owns('skyline_source'))->toBeFalse();

    unlink($path);
});
