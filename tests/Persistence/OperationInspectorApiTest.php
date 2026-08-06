<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Telemetry\SqlCapture;
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
