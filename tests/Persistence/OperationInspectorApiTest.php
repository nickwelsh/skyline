<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Telemetry\SqlCapture;
use NickWelsh\Skyline\Telemetry\ValueCapture;
use Tests\Fixtures\Jobs\CacheJob;
use Tests\Fixtures\Jobs\RedisJob;
use Tests\Fixtures\Jobs\SqlJob;
use Tests\Fixtures\Jobs\TransactionJob;

it('projects SQL evidence through a discriminated privacy-bounded contract', function (): void {
    SqlJob::dispatchSync('private-job-payload');
    $run = DB::table('skyline_runs')->where('job_name', SqlJob::class)->first();
    $span = DB::table('skyline_spans')->where('run_id', $run->run_id)->where('role', 'sql')->first();

    $uncaptured = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'sql')
        ->assertJsonPath('node.presentation.sql.statement.value', 'select ? as private_value')
        ->assertJsonPath('node.presentation.sql.bindings', null)
        ->assertJsonPath('node.presentation.sql.result', null)
        ->assertJsonPath('node.presentation.failure', null);

    expect($uncaptured->json('node.presentation.timing.durationUs'))->toBeInt()->toBeGreaterThanOrEqual(0)
        ->and($uncaptured->getContent())->not->toContain('private-job-payload')->not->toContain('do-not-capture');

    config()->set('skyline.sql.capture_bindings', true);
    config()->set('skyline.sql.capture_results', true);
    config()->set('skyline.sql.capture_source', true);
    app(SqlCapture::class)->boot();
    SqlJob::dispatchSync();
    $capturedRun = DB::table('skyline_runs')
        ->where('job_name', SqlJob::class)
        ->where('run_id', '!=', $run->run_id)
        ->first();
    $capturedSpan = DB::table('skyline_spans')->where('run_id', $capturedRun->run_id)->where('role', 'sql')->first();

    $this->getJson('/skyline/api/runs/'.$capturedRun->run_id.'/nodes/span_'.$capturedSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'sql')
        ->assertJsonPath('node.presentation.sql.bindings.items.0.value', 'do-not-capture')
        ->assertJsonPath('node.presentation.sql.result.kind', 'rows')
        ->assertJsonPath('node.presentation.sql.result.rows.0.private_value', 'do-not-capture')
        ->assertJsonPath('node.source.file', 'tests/Fixtures/Jobs/SqlJob.php')
        ->assertJsonMissingPath('node.metadata.value.attributes.skyline.sql.bindings')
        ->assertJsonMissingPath('node.metadata.value.attributes.skyline.sql.result');
});

it('projects nested and rolled-back transactions with recorded causal identity', function (): void {
    config()->set('database.connections.secondary', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ]);
    TransactionJob::dispatchSync();
    $run = DB::table('skyline_runs')->where('job_name', TransactionJob::class)->first();
    $transactions = DB::table('skyline_spans')->where('run_id', $run->run_id)->where('role', 'transaction')->get();
    $attributes = fn (object $span): array => json_decode($span->attributes, true, flags: JSON_THROW_ON_ERROR);
    $outer = $transactions->first(fn (object $span): bool => ($attributes($span)['db.transaction.depth'] ?? null) === 1
        && ($attributes($span)['db.namespace'] ?? null) === 'testing'
        && ($attributes($span)['db.transaction.outcome'] ?? null) === 'committed');
    $nested = $transactions->first(fn (object $span): bool => ($attributes($span)['db.transaction.depth'] ?? null) === 2);
    $rolledBack = $transactions->first(fn (object $span): bool => ($attributes($span)['db.transaction.outcome'] ?? null) === 'rolled_back');

    $nestedResponse = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$nested->span_id)
        ->assertOk()
        ->assertJsonPath('node.kind', 'transaction')
        ->assertJsonPath('node.presentation.type', 'transaction')
        ->assertJsonPath('node.presentation.transaction.connection', 'testing')
        ->assertJsonPath('node.presentation.transaction.depth', 2)
        ->assertJsonPath('node.presentation.transaction.outcome', 'committed')
        ->assertJsonPath('node.overview.parentSpanId', $outer->span_id)
        ->assertJsonPath('node.parentId', 'span_'.$outer->span_id)
        ->assertJsonPath('node.presentation.failure', null);

    expect($nestedResponse->json('node.presentation.transaction.queryTimeMs'))->toBeFloat()->toBeGreaterThanOrEqual(0)
        ->and($nestedResponse->json('node.presentation.timing.durationUs'))->toBeInt()->toBeGreaterThanOrEqual(0);

    $rolledBackResponse = $this->getJson('/skyline/api/runs/'.$run->run_id.'/nodes/span_'.$rolledBack->span_id)
        ->assertOk()
        ->assertJsonPath('node.status', 'failed')
        ->assertJsonPath('node.presentation.type', 'transaction')
        ->assertJsonPath('node.presentation.transaction.outcome', 'rolled_back');

    expect($rolledBackResponse->json('node.presentation.failure'))->toBe(['type' => null, 'message' => null])
        ->and($rolledBackResponse->getContent())->not->toContain('rollback reason');
});

it('projects cache and Redis state without widening capture', function (): void {
    CacheJob::dispatchSync();
    $cacheRun = DB::table('skyline_runs')->where('job_name', CacheJob::class)->first();
    $cacheSpan = DB::table('skyline_spans')
        ->where('run_id', $cacheRun->run_id)
        ->where('role', 'cache')
        ->where('attributes', 'like', '%"cache.operation":"PUT"%')
        ->first();

    $cache = $this->getJson('/skyline/api/runs/'.$cacheRun->run_id.'/nodes/span_'.$cacheSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'cache')
        ->assertJsonPath('node.presentation.cache.operation', 'PUT')
        ->assertJsonPath('node.presentation.cache.keyCaptured', false)
        ->assertJsonPath('node.presentation.cache.value', null)
        ->assertJsonPath('node.presentation.cache.forever', null)
        ->assertJsonPath('node.presentation.cache.outcome', 'stored');

    expect($cache->json('node.presentation.cache.key'))->toStartWith('sha256:')
        ->and($cache->getContent())->not->toContain('secret@example.test')->not->toContain('private-value');

    config()->set('skyline.redis.capture_arguments', true);
    RedisJob::dispatchSync();
    $redisRun = DB::table('skyline_runs')->where('job_name', RedisJob::class)->first();
    $redisSpan = DB::table('skyline_spans')->where('run_id', $redisRun->run_id)->where('role', 'redis')->first();
    DB::table('skyline_spans')->where('id', $redisSpan->id)->update([
        'status_code' => 'ERROR',
        'status_description' => 'Redis command failed',
    ]);

    $this->getJson('/skyline/api/runs/'.$redisRun->run_id.'/nodes/span_'.$redisSpan->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.type', 'redis')
        ->assertJsonPath('node.presentation.redis.command', 'SET')
        ->assertJsonPath('node.presentation.redis.connection', 'default')
        ->assertJsonPath('node.presentation.redis.outcome', 'failed')
        ->assertJsonPath('node.presentation.redis.arguments.value.0', 'private-key')
        ->assertJsonPath('node.presentation.failure.message', 'Redis command failed');
});

it('reapplies current privacy gates and byte limits to persisted inspector captures', function (): void {
    config()->set('skyline.sql.capture_bindings', true);
    config()->set('skyline.sql.capture_results', true);
    config()->set('skyline.cache.capture_keys', true);
    config()->set('skyline.cache.capture_values', true);
    config()->set('skyline.redis.capture_arguments', true);

    SqlJob::dispatchSync();
    CacheJob::dispatchSync();
    RedisJob::dispatchSync();

    $sql = DB::table('skyline_spans')->where('role', 'sql')->first();
    $sqlAttributes = json_decode($sql->attributes, true, flags: JSON_THROW_ON_ERROR);
    $sqlAttributes['db.query.text'] = str_repeat('select private ', 8);
    $sqlAttributes['skyline.sql.bindings'] = json_encode([
        'items' => [
            ['position' => 0, 'column' => 'api_token', 'value' => str_repeat('secret', 20)],
            ['position' => 1, 'column' => 'name', 'value' => str_repeat('visible', 20)],
        ],
        'truncated' => false,
    ], JSON_THROW_ON_ERROR);
    $sqlAttributes['skyline.sql.result'] = json_encode([
        'kind' => 'rows',
        'rows' => [
            ['id' => 1, 'payload' => str_repeat('result', 20)],
            ['id' => 2, 'payload' => str_repeat('other', 20)],
        ],
        'rowCount' => 2,
        'truncated' => false,
    ], JSON_THROW_ON_ERROR);
    DB::table('skyline_spans')->where('id', $sql->id)->update(['attributes' => json_encode($sqlAttributes, JSON_THROW_ON_ERROR)]);

    $cache = DB::table('skyline_spans')->where('role', 'cache')->where('attributes', 'like', '%"cache.operation":"PUT"%')->first();
    $cacheAttributes = json_decode($cache->attributes, true, flags: JSON_THROW_ON_ERROR);
    $cacheAttributes['cache.key'] = 'customer:raw-private-key';
    $cacheAttributes['cache.key_captured'] = true;
    $cacheAttributes['cache.value'] = app(ValueCapture::class)->encode(str_repeat('cache-value', 20), 1_000);
    DB::table('skyline_spans')->where('id', $cache->id)->update(['attributes' => json_encode($cacheAttributes, JSON_THROW_ON_ERROR)]);

    $redis = DB::table('skyline_spans')->where('role', 'redis')->first();
    $redisAttributes = json_decode($redis->attributes, true, flags: JSON_THROW_ON_ERROR);
    $redisAttributes['db.operation.arguments'] = app(ValueCapture::class)->encode([str_repeat('redis-key', 20), str_repeat('redis-value', 20)], 1_000);
    DB::table('skyline_spans')->where('id', $redis->id)->update(['attributes' => json_encode($redisAttributes, JSON_THROW_ON_ERROR)]);

    config()->set('skyline.privacy.sql_bytes', 12);
    config()->set('skyline.sql.max_binding_bytes', 96);
    config()->set('skyline.sql.max_result_rows', 1);
    config()->set('skyline.sql.max_result_bytes', 80);
    config()->set('skyline.cache.capture_keys', false);
    config()->set('skyline.cache.max_value_bytes', 16);
    config()->set('skyline.redis.max_argument_bytes', 20);

    $sqlResponse = $this->getJson('/skyline/api/runs/'.$sql->run_id.'/nodes/span_'.$sql->span_id)->assertOk();
    expect($sqlResponse->json('node.presentation.sql.statement'))
        ->toMatchArray(['isTruncated' => true, 'originalBytes' => 120])
        ->and(strlen($sqlResponse->json('node.presentation.sql.statement.value')))->toBeLessThanOrEqual(12)
        ->and($sqlResponse->json('node.presentation.sql.bindings.items.0.value'))->toBe('[REDACTED]')
        ->and($sqlResponse->json('node.presentation.sql.bindings.truncated'))->toBeTrue()
        ->and($sqlResponse->json('node.presentation.sql.bindings.originalBytes'))->toBeGreaterThan(96)
        ->and($sqlResponse->json('node.presentation.sql.result.rows'))->toHaveCount(0)
        ->and($sqlResponse->json('node.presentation.sql.result.truncated'))->toBeTrue()
        ->and($sqlResponse->json('node.presentation.sql.result.originalBytes'))->toBeGreaterThan(80)
        ->and($sqlResponse->getContent())->not->toContain(str_repeat('visible', 10))->not->toContain(str_repeat('result', 10));

    $cacheResponse = $this->getJson('/skyline/api/runs/'.$cache->run_id.'/nodes/span_'.$cache->span_id)->assertOk();
    expect($cacheResponse->json('node.presentation.cache.key'))->toStartWith('sha256:')
        ->and($cacheResponse->json('node.presentation.cache.keyCaptured'))->toBeFalse()
        ->and($cacheResponse->json('node.presentation.cache.value.originalBytes'))->toBe(222)
        ->and($cacheResponse->json('node.presentation.cache.value.truncated'))->toBeTrue()
        ->and(strlen($cacheResponse->json('node.presentation.cache.value.value')))->toBeLessThanOrEqual(16)
        ->and($cacheResponse->getContent())->not->toContain('customer:raw-private-key');

    $redisResponse = $this->getJson('/skyline/api/runs/'.$redis->run_id.'/nodes/span_'.$redis->span_id)->assertOk();
    expect($redisResponse->json('node.presentation.redis.arguments.originalBytes'))->toBeGreaterThan(300)
        ->and($redisResponse->json('node.presentation.redis.arguments.truncated'))->toBeTrue()
        ->and(strlen($redisResponse->json('node.presentation.redis.arguments.value')))->toBeLessThanOrEqual(20);

    config()->set('skyline.sql.capture_bindings', false);
    config()->set('skyline.sql.capture_results', false);
    config()->set('skyline.cache.capture_values', false);
    config()->set('skyline.redis.capture_arguments', false);

    $this->getJson('/skyline/api/runs/'.$sql->run_id.'/nodes/span_'.$sql->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.sql.bindings', null)
        ->assertJsonPath('node.presentation.sql.result', null);
    $this->getJson('/skyline/api/runs/'.$cache->run_id.'/nodes/span_'.$cache->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.cache.value', null);
    $this->getJson('/skyline/api/runs/'.$redis->run_id.'/nodes/span_'.$redis->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.redis.arguments', null);
});

it('keeps absent cache key counts unavailable for flush and lock operations', function (string $operation): void {
    CacheJob::dispatchSync();
    $span = DB::table('skyline_spans')->where('role', 'cache')->first();
    $attributes = json_decode($span->attributes, true, flags: JSON_THROW_ON_ERROR);
    $attributes['cache.operation'] = $operation;
    unset($attributes['cache.key'], $attributes['cache.key_count']);
    DB::table('skyline_spans')->where('id', $span->id)->update(['attributes' => json_encode($attributes, JSON_THROW_ON_ERROR)]);

    $this->getJson('/skyline/api/runs/'.$span->run_id.'/nodes/span_'.$span->span_id)
        ->assertOk()
        ->assertJsonPath('node.presentation.cache.operation', $operation)
        ->assertJsonPath('node.presentation.cache.key', null)
        ->assertJsonPath('node.presentation.cache.keyCount', null);
})->with(['FLUSH', 'LOCK FLUSH']);
