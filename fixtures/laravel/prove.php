<?php

declare(strict_types=1);

$fixture = __DIR__;
$database = $fixture.'/database/database.sqlite';
$queueConnection = ($argv[1] ?? getenv('SKYLINE_PROOF_QUEUE_CONNECTION')) ?: 'database';
$queue = 'skyline-proof';
$environment = [...getenv(),
    'APP_ENV' => 'local',
    'APP_KEY' => 'base64:'.base64_encode(str_repeat('a', 32)),
    'DB_CONNECTION' => getenv('DB_CONNECTION') ?: 'sqlite',
    'DB_DATABASE' => getenv('DB_DATABASE') ?: $database,
    'QUEUE_CONNECTION' => $queueConnection,
    'DB_QUEUE' => $queue,
    'REDIS_QUEUE' => $queue,
    'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'array',
    'LOG_CHANNEL' => 'null',
];

if ($environment['DB_CONNECTION'] === 'sqlite' && ! file_exists($environment['DB_DATABASE'])) {
    touch($environment['DB_DATABASE']);
}

$run = static function (array $arguments) use ($fixture, $environment): void {
    $process = proc_open([PHP_BINARY, $fixture.'/artisan', ...$arguments], [STDIN, STDOUT, STDERR], $pipes, $fixture, $environment);
    $status = is_resource($process) ? proc_close($process) : 1;

    if ($status !== 0) {
        exit($status);
    }
};

$run(['vendor:publish', '--tag=skyline-migrations', '--force', '--no-interaction']);
$run(['migrate:fresh', '--force', '--no-interaction']);
$run(['queue:clear', $queueConnection, '--queue='.$queue, '--no-interaction']);
$run(['skyline:prove', 'dispatch', '--no-interaction']);
$run(['queue:work', $queueConnection, '--queue='.$queue, '--stop-when-empty', '--tries=3', '--backoff=0', '--sleep=0']);
$run(['skyline:prove', 'assert', '--no-interaction']);
