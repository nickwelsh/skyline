<?php

use Illuminate\Support\Facades\DB;
use NickWelsh\Skyline\Read\Nanoseconds;

it('groups failed Attempts by stable message-free relative exception fingerprints', function (): void {
    $now = Nanoseconds::now();
    seedErrorOccurrence(1, 'App\\Jobs\\Invoice', 'RuntimeException', 'Invoice 123 failed', '/srv/one/app/Jobs/Invoice.php', 14, 'App\\Jobs\\Invoice->handle', $now - 4_000_000_000);
    seedErrorOccurrence(2, 'App\\Jobs\\Invoice', 'RuntimeException', 'Invoice 999 failed', '/Users/example/two/app/Jobs/Invoice.php', 99, 'App\\Jobs\\Invoice->handle', $now - 3_000_000_000);
    seedErrorOccurrence(3, 'App\\Jobs\\Invoice', 'RuntimeException', 'Other callable', '/srv/one/app/Jobs/Invoice.php', 14, 'App\\Jobs\\Invoice->retry', $now - 2_000_000_000);
    seedErrorOccurrence(4, 'App\\Jobs\\Digest', 'RuntimeException', 'Other Job type', '/srv/one/app/Jobs/Invoice.php', 14, 'App\\Jobs\\Invoice->handle', $now - 1_000_000_000);

    $response = $this->getJson('/skyline/api/errors?period=all')->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('capabilities.errors.view', true)
        ->assertJsonPath('capabilities.errors.resolve', false)
        ->assertJsonPath('capabilities.errors.assign', false)
        ->assertJsonCount(3, 'errorGroups');

    $group = collect($response->json('errorGroups'))->firstWhere('occurrenceCount', 2);

    expect($group)
        ->toMatchArray([
            'jobType' => 'App\\Jobs\\Invoice',
            'exceptionClass' => 'RuntimeException',
            'representativeMessage' => 'Invoice 999 failed',
            'occurrenceCount' => 2,
        ])
        ->and($group['id'])->toStartWith('error_')->not->toContain('Invoice')
        ->and($group['fingerprint'])->toMatch('/^[a-f0-9]{64}$/')
        ->and($group['href'])->toBe('/skyline/errors/'.$group['id'])
        ->and($group['latest']['runId'])->toBe('error-run-02')
        ->and($group['latest']['attemptNumber'])->toBe(1)
        ->and($group['latest']['runHref'])->toBe('/skyline/runs/error-run-02')
        ->and($group['latest']['attemptHref'])->toBe('/skyline/runs/error-run-02?node=attempt_error-run-02_1')
        ->and(collect($group['activity'])->sum('occurrences'))->toBe(2)
        ->and($group['firstObservedAt'])->toEndWith('Z')
        ->and($group['lastObservedAt'])->toEndWith('Z');
});

it('filters Error groups through URL state and returns server-supplied options', function (): void {
    $now = Nanoseconds::now();
    seedErrorOccurrence(10, 'App\\Jobs\\RecentInvoice', 'RuntimeException', 'Recent invoice', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\RecentInvoice->handle', $now - 3_600_000_000_000);
    seedErrorOccurrence(11, 'App\\Jobs\\OldInvoice', 'RuntimeException', 'Old invoice', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\OldInvoice->handle', $now - 8 * 86_400_000_000_000);
    seedErrorOccurrence(12, 'App\\Jobs\\RecentDigest', 'LogicException', 'Recent digest', '/srv/app/Jobs/Digest.php', 10, 'App\\Jobs\\RecentDigest->handle', $now - 3_600_000_000_000);

    $query = http_build_query([
        'jobType' => 'App\\Jobs\\RecentInvoice',
        'exceptionClass' => 'RuntimeException',
        'period' => '7d',
    ]);
    $response = $this->getJson('/skyline/api/errors?'.$query)->assertOk()
        ->assertJsonCount(1, 'errorGroups')
        ->assertJsonPath('errorGroups.0.jobType', 'App\\Jobs\\RecentInvoice')
        ->assertJsonPath('filters.jobType', 'App\\Jobs\\RecentInvoice')
        ->assertJsonPath('filters.exceptionClass', 'RuntimeException')
        ->assertJsonPath('filters.period', '7d');

    expect($response->json('options.jobTypes'))->toBe([
        'App\\Jobs\\OldInvoice',
        'App\\Jobs\\RecentDigest',
        'App\\Jobs\\RecentInvoice',
    ])->and($response->json('options.exceptionClasses'))->toBe(['LogicException', 'RuntimeException'])
        ->and(collect($response->json('options.timeRanges'))->pluck('value')->all())->toBe(['1h', '24h', '7d', '30d', 'all']);

    $this->getJson('/skyline/api/errors?period=fortnight')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('searches Error evidence literally across messages classes operations and Run identities', function (): void {
    seedErrorOccurrence(70, 'App\\Jobs\\Invoice', 'RuntimeException', 'Payment declined', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\Invoice->handle');
    seedErrorOccurrence(71, 'App\\Jobs\\Digest', 'DomainException', 'Digest failed', '/srv/app/Jobs/Digest.php', 20, 'App\\Jobs\\Digest->deliver');
    seedErrorOccurrence(72, 'App\\Jobs\\Export', 'LogicException', 'Export failed', '/srv/app/Jobs/Export.php', 30, 'App\\Jobs\\Export->archive');
    seedErrorOccurrence(73, 'App\\Jobs\\Literal', 'UnexpectedValueException', 'Literal %_ marker', '/srv/app/Jobs/Literal.php', 40, 'App\\Jobs\\Literal->handle');

    foreach (['declined', 'domainexception', 'archive', 'run-73', '%_'] as $search) {
        $this->getJson('/skyline/api/errors?'.http_build_query(['period' => 'all', 'search' => $search]))
            ->assertOk()
            ->assertJsonCount(1, 'errorGroups')
            ->assertJsonPath('filters.search', $search);
    }

    $this->getJson('/skyline/api/errors?search[]=invalid')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
    $this->getJson('/skyline/api/errors?'.http_build_query(['search' => str_repeat('x', 513)]))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('defaults Error-group and occurrence evidence to the source time ranges', function (): void {
    $now = Nanoseconds::now();
    seedErrorOccurrence(60, 'App\\Jobs\\Invoice', 'RuntimeException', 'Recent failure', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\Invoice->handle', $now - 3_600_000_000_000);
    seedErrorOccurrence(61, 'App\\Jobs\\Invoice', 'RuntimeException', 'Two-day failure', '/srv/app/Jobs/Invoice.php', 20, 'App\\Jobs\\Invoice->handle', $now - 2 * 86_400_000_000_000);
    seedErrorOccurrence(62, 'App\\Jobs\\Invoice', 'RuntimeException', 'Eight-day failure', '/srv/app/Jobs/Invoice.php', 30, 'App\\Jobs\\Invoice->handle', $now - 8 * 86_400_000_000_000);

    $page = $this->getJson('/skyline/api/errors')->assertOk()
        ->assertJsonPath('filters.period', '24h')
        ->assertJsonCount(1, 'errorGroups')
        ->assertJsonPath('errorGroups.0.occurrenceCount', 1);

    $all = $this->getJson('/skyline/api/errors?period=all')->assertOk()
        ->assertJsonPath('errorGroups.0.occurrenceCount', 3);

    expect(collect($all->json('errorGroups.0.activity'))->sum('occurrences'))->toBe(1)
        ->and($all->json('errorGroups.0.activity.0.timestamp'))->toMatch('/T\d{2}:00:00Z$/');

    $this->getJson('/skyline/api/errors/'.$page->json('errorGroups.0.id'))
        ->assertOk()
        ->assertJsonPath('filters.period', '7d')
        ->assertJsonPath('errorGroup.occurrenceCount', 3)
        ->assertJsonCount(2, 'failedAttempts')
        ->assertJsonPath('failedAttempts.0.exception.message', 'Recent failure')
        ->assertJsonPath('failedAttempts.1.exception.message', 'Two-day failure');
});

it('filters and orders Error occurrences by their observed completion time', function (): void {
    $now = Nanoseconds::now();
    seedErrorOccurrence(80, 'App\\Jobs\\Invoice', 'RuntimeException', 'Latest observed failure', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\Invoice->handle', $now - 2 * 3_600_000_000_000, $now - 10 * 60_000_000_000);
    seedErrorOccurrence(81, 'App\\Jobs\\Invoice', 'RuntimeException', 'Earlier observed failure', '/srv/app/Jobs/Invoice.php', 20, 'App\\Jobs\\Invoice->handle', $now - 20 * 60_000_000_000, $now - 15 * 60_000_000_000);
    seedErrorOccurrence(82, 'App\\Jobs\\Digest', 'LogicException', 'Outside boundary', '/srv/app/Jobs/Digest.php', 30, 'App\\Jobs\\Digest->handle', $now - 2 * 3_600_000_000_000, $now - 61 * 60_000_000_000);

    $page = $this->getJson('/skyline/api/errors?period=1h')
        ->assertOk()
        ->assertJsonCount(1, 'errorGroups')
        ->assertJsonPath('errorGroups.0.occurrenceCount', 2)
        ->assertJsonPath('errorGroups.0.representativeMessage', 'Latest observed failure')
        ->assertJsonPath('errorGroups.0.latest.runId', 'error-run-80');

    $this->getJson('/skyline/api/errors/'.$page->json('errorGroups.0.id').'?period=1h')
        ->assertOk()
        ->assertJsonCount(2, 'failedAttempts')
        ->assertJsonPath('representative.message', 'Latest observed failure')
        ->assertJsonPath('failedAttempts.0.runId', 'error-run-80')
        ->assertJsonPath('failedAttempts.1.runId', 'error-run-81');
});

it('filters Error groups and detail activity with custom durations and exact ranges', function (): void {
    $now = Nanoseconds::now();
    seedErrorOccurrence(83, 'App\\Jobs\\Invoice', 'RuntimeException', 'Recent failure', '/srv/app/Jobs/Invoice.php', 10, 'App\\Jobs\\Invoice->handle', $now - 5 * 60_000_000_000);
    seedErrorOccurrence(84, 'App\\Jobs\\Invoice', 'RuntimeException', 'Older failure', '/srv/app/Jobs/Invoice.php', 20, 'App\\Jobs\\Invoice->handle', $now - 2 * 3_600_000_000_000);
    $group = $this->getJson('/skyline/api/errors?period=all')->assertOk()->json('errorGroups.0');

    $this->getJson('/skyline/api/errors/'.$group['id'].'?period=90m')
        ->assertOk()
        ->assertJsonPath('filters.period', '90m')
        ->assertJsonPath('filters.from', null)
        ->assertJsonPath('filters.to', null)
        ->assertJsonCount(1, 'failedAttempts')
        ->assertJsonStructure(['activityRange' => ['from', 'to']]);

    $from = intdiv($now - 3 * 3_600_000_000_000, 1_000_000);
    $to = intdiv($now - 90 * 60_000_000_000, 1_000_000);
    $query = http_build_query(['from' => $from, 'to' => $to]);
    $this->getJson('/skyline/api/errors?'.$query)
        ->assertOk()
        ->assertJsonPath('filters.period', null)
        ->assertJsonPath('filters.from', (string) $from)
        ->assertJsonPath('filters.to', (string) $to)
        ->assertJsonCount(1, 'errorGroups');

    $this->getJson('/skyline/api/errors/'.$group['id'].'?'.$query)
        ->assertOk()
        ->assertJsonPath('filters.period', null)
        ->assertJsonPath('filters.from', (string) $from)
        ->assertJsonPath('filters.to', (string) $to)
        ->assertJsonCount(1, 'failedAttempts')
        ->assertJsonPath('failedAttempts.0.exception.message', 'Older failure');
});

it('shows representative frames activity and cursor-paginated original occurrences', function (): void {
    for ($index = 20; $index < 47; $index++) {
        seedErrorOccurrence(
            $index,
            'App\\Jobs\\Invoice',
            'RuntimeException',
            "Invoice {$index} failed",
            '/srv/product/app/Jobs/Invoice.php',
            $index,
            'App\\Jobs\\Invoice->handle',
        );
    }

    $group = $this->getJson('/skyline/api/errors?period=all')->assertOk()->json('errorGroups.0');
    $first = $this->getJson('/skyline/api/errors/'.$group['id'].'?period=all')
        ->assertOk()
        ->assertJsonPath('errorGroup.id', $group['id'])
        ->assertJsonPath('errorGroup.occurrenceCount', 27)
        ->assertJsonPath('representative.class', 'RuntimeException')
        ->assertJsonPath('representative.frames.0.file', 'app/Jobs/Invoice.php')
        ->assertJsonPath('representative.frames.0.isVendor', false)
        ->assertJsonPath('representative.frames.2.isVendor', true)
        ->assertJsonCount(25, 'failedAttempts')
        ->assertJsonPath('failedAttempts.0.exception.message', 'Invoice 46 failed')
        ->assertJsonPath('failedAttempts.0.exception.frames.0.line', 46)
        ->assertJsonPath('failedAttempts.0.runId', 'error-run-46')
        ->assertJsonPath('failedAttempts.0.attemptNumber', 1)
        ->assertJsonPath('failedAttempts.0.connection', 'redis')
        ->assertJsonPath('failedAttempts.0.queue', 'default')
        ->assertJsonPath('hasAnyOccurrences', true);

    expect($first->json('activity'))->not->toBeEmpty()
        ->and(collect($first->json('activity'))->sum('occurrences'))->toBe(27)
        ->and($first->json('failedAttempts.0.id'))->toBe('attempt_error-run-46_1')
        ->and($first->json('failedAttempts.0.triggeredAt'))->toBeString()
        ->and($first->json('failedAttempts.0.runHref'))->toBe('/skyline/runs/error-run-46')
        ->and($first->json('failedAttempts.0.attemptHref'))->toBe('/skyline/runs/error-run-46?node=attempt_error-run-46_1');

    $next = $first->json('pagination.next');
    expect($next)->toBeString()->not->toContain('error-run');

    $this->getJson('/skyline/api/errors/'.$group['id'].'?'.http_build_query(['period' => '7d', 'cursor' => $next]))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');

    $this->getJson('/skyline/api/errors/'.$group['id'].'?'.http_build_query(['period' => 'all', 'cursor' => $next]))
        ->assertOk()
        ->assertJsonCount(2, 'failedAttempts')
        ->assertJsonPath('failedAttempts.1.exception.message', 'Invoice 20 failed')
        ->assertJsonPath('pagination.next', null);
});

it('cursor-paginates Error groups in stable order and binds cursors to filters', function (): void {
    $startedAt = 1_786_000_000_000_000_000;
    for ($index = 100; $index < 127; $index++) {
        seedErrorOccurrence(
            $index,
            'App\\Jobs\\Invoice',
            'RuntimeException',
            "Invoice {$index} failed",
            "/srv/product/app/Jobs/Invoice{$index}.php",
            42,
            "App\\Jobs\\Invoice{$index}->handle",
            $startedAt,
        );
    }

    $first = $this->getJson('/skyline/api/errors?'.http_build_query(['jobType' => 'App\\Jobs\\Invoice', 'period' => 'all']))
        ->assertOk()
        ->assertJsonCount(25, 'errorGroups')
        ->assertJsonPath('pagination.previous', null);
    $firstIds = $first->json('errorGroups.*.id');
    $nextCursor = $first->json('pagination.next');

    expect($nextCursor)->toBeString()->not->toContain('error_');

    $second = $this->getJson('/skyline/api/errors?'.http_build_query([
        'jobType' => 'App\\Jobs\\Invoice',
        'period' => 'all',
        'cursor' => $nextCursor,
    ]))->assertOk()
        ->assertJsonCount(2, 'errorGroups')
        ->assertJsonPath('pagination.next', null);

    expect(array_intersect($second->json('errorGroups.*.id'), $firstIds))->toBeEmpty()
        ->and($second->json('pagination.previous'))->toBeString();

    $previous = $this->getJson('/skyline/api/errors?'.http_build_query([
        'jobType' => 'App\\Jobs\\Invoice',
        'period' => 'all',
        'cursor' => $second->json('pagination.previous'),
    ]))->assertOk()->assertJsonCount(25, 'errorGroups');

    expect($previous->json('errorGroups.*.id'))->toBe($firstIds);

    $this->getJson('/skyline/api/errors?'.http_build_query([
        'exceptionClass' => 'RuntimeException',
        'cursor' => $nextCursor,
    ]))->assertStatus(422)->assertJsonPath('error.code', 'invalid_query');
});

it('falls back to a relative origin file and distinguishes empty filtered and missing Error groups', function (): void {
    seedErrorOccurrence(50, 'App\\Jobs\\Import', 'RuntimeException', 'First dynamic message', '/private/root/Import.php', 10, 'Vendor\\Runner->process');
    seedErrorOccurrence(51, 'App\\Jobs\\Import', 'RuntimeException', 'Second dynamic message', '/another/root/Import.php', 90, 'Vendor\\Runner->process');

    $page = $this->getJson('/skyline/api/errors?period=all')->assertOk()
        ->assertJsonCount(1, 'errorGroups')
        ->assertJsonPath('errorGroups.0.occurrenceCount', 2)
        ->assertJsonPath('hasAnyErrorGroups', true);

    $this->getJson('/skyline/api/errors?'.http_build_query(['exceptionClass' => 'LogicException', 'period' => 'all']))
        ->assertOk()
        ->assertJsonCount(0, 'errorGroups')
        ->assertJsonPath('hasAnyErrorGroups', true);

    $this->getJson('/skyline/api/errors/error_missing')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found');

    $this->getJson('/skyline/api/errors/'.$page->json('errorGroups.0.id').'?cursor=invalid')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'invalid_query');
});

it('returns an honest initial empty Error-group page', function (): void {
    $this->getJson('/skyline/api/errors')->assertOk()
        ->assertJsonCount(0, 'errorGroups')
        ->assertJsonPath('hasAnyErrorGroups', false);
});

function seedErrorOccurrence(
    int $index,
    string $jobType,
    string $exceptionClass,
    string $message,
    string $file,
    int $line,
    string $callable,
    ?int $startedAt = null,
    ?int $finishedAt = null,
): void {
    $traceId = sprintf('%032x', $index + 20_000);
    $runId = sprintf('error-run-%02d', $index);
    $startedAt ??= 1_786_000_000_000_000_000 + ($index * 1_000_000_000);
    $finishedAt ??= $startedAt + 500_000_000;

    DB::table('skyline_traces')->insert([
        'trace_id' => $traceId,
        'root_run_id' => $runId,
        'revision' => 1,
        'last_activity_at' => $startedAt + 500_000_000,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_runs')->insert([
        'run_id' => $runId,
        'trace_id' => $traceId,
        'job_name' => $jobType,
        'connection' => 'redis',
        'queue' => 'default',
        'status' => 'failed',
        'triggered_at' => $startedAt - 1_000,
        'queued_at' => $startedAt - 500,
        'started_at' => $startedAt,
        'finished_at' => $finishedAt,
        'confirmed_at' => $finishedAt,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('skyline_attempts')->insert([
        'run_id' => $runId,
        'attempt_number' => 1,
        'status' => 'failed',
        'started_at' => $startedAt,
        'finished_at' => $finishedAt,
        'exception_class' => $exceptionClass,
        'exception_message' => $message,
        'exception_code' => '500',
        'exception_file' => $file,
        'exception_line' => $line,
        'exception_trace' => "#0 {$file}({$line}): {$callable}({$index})\n#1 /srv/one/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(10): Illuminate\\Queue\\Worker->process()",
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}
