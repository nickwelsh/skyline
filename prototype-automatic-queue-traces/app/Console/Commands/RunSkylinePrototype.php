<?php

namespace App\Console\Commands;

use App\Jobs\RetryJob;
use App\Jobs\RootJob;
use App\Jobs\TerminalFailureJob;
use App\Telemetry\SkylinePrototype;
use Composer\InstalledVersions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;

final class RunSkylinePrototype extends Command
{
    protected $signature = 'skyline:prototype {--once : Run and print the proof without the interactive shell}';

    protected $description = 'Prove automatic Laravel queue tracing without Job instrumentation';

    public function handle(SkylinePrototype $skyline): int
    {
        if ($this->option('once')) {
            $this->renderOnce($this->runScenario($skyline));

            return self::SUCCESS;
        }

        $state = null;
        $view = 'summary';

        while (true) {
            $this->renderTui($state, $view);
            $input = fgets(STDIN);

            if ($input === false) {
                return self::SUCCESS;
            }

            $key = strtolower(trim($input));

            if ($key === 'q') {
                return self::SUCCESS;
            }

            if ($key === 'r') {
                $state = $this->runScenario($skyline);
                $view = 'summary';
            }

            if ($key === 'g' && $state !== null) {
                $view = $view === 'summary' ? 'graph' : 'summary';
            }
        }
    }

    /** @return array<string, mixed> */
    private function runScenario(SkylinePrototype $skyline): array
    {
        $skyline->reset();
        DB::table('jobs')->delete();
        DB::table('failed_jobs')->delete();
        DB::table('prototype_records')->delete();

        RootJob::dispatch();
        RetryJob::dispatch();
        TerminalFailureJob::dispatch();

        usleep(1_100_000);

        $this->callSilently('queue:work', [
            'connection' => 'database',
            '--queue' => 'default',
            '--stop-when-empty' => true,
            '--tries' => 2,
            '--backoff' => 0,
            '--sleep' => 0,
        ]);

        $spans = $skyline->spans();
        $producers = $this->role($spans, 'producer');
        $consumers = $this->role($spans, 'consumer');
        $sql = $this->role($spans, 'sql');
        $rootProducer = $this->oneJob($producers, RootJob::class);
        $rootConsumer = $this->oneJob($consumers, RootJob::class);
        $childProducer = $this->oneJob($producers, 'App\\Jobs\\ChildJob');
        $childConsumer = $this->oneJob($consumers, 'App\\Jobs\\ChildJob');
        $retry = $this->job($consumers, RetryJob::class);
        $failure = $this->job($consumers, TerminalFailureJob::class);
        $jobSource = implode('', array_map('file_get_contents', glob(app_path('Jobs/*.php'))));

        $this->ensure(count($producers) === 4, 'four Runs create producer spans');
        $this->ensure(count($consumers) === 6, 'six Attempts create consumer spans');
        $this->ensure(count($sql) >= 7, 'SQL inside active Attempts creates child spans');
        $this->ensure(count(array_unique(array_column($consumers, 'trace_id'))) === 3, 'three root Runs create three Traces');
        $this->ensure($rootConsumer['parent_span_id'] === $rootProducer['span_id'], 'root Attempt follows its producer');
        $this->ensure($childProducer['parent_span_id'] === $rootConsumer['span_id'], 'child Run follows active parent Attempt');
        $this->ensure($childConsumer['parent_span_id'] === $childProducer['span_id'], 'child Attempt follows child producer');
        $this->ensure($childConsumer['trace_id'] === $rootConsumer['trace_id'], 'child Run remains in root Trace');
        $this->ensure(array_column($retry, 'attributes', 'span_id') !== [], 'retry spans exist');
        $this->ensure($this->outcomes($retry) === ['retry', 'success'], 'retry outcomes remain retry then success');
        $this->ensure($this->attempts($retry) === [1, 2], 'retry Attempts remain one Run');
        $this->ensure(count(array_unique(array_column($retry, 'trace_id'))) === 1, 'retry Attempts remain one Trace');
        $this->ensure($this->outcomes($failure) === ['retry', 'failure'], 'terminal failure remains retry then failure');
        $this->ensure($this->attempts($failure) === [1, 2], 'terminal failure creates two Attempts');
        $this->ensure(($rootConsumer['attributes']['skyline.queue_time_ms'] ?? 0) >= 1_000, 'queue time captures pre-worker wait');
        $this->ensure(DB::table('failed_jobs')->count() === 1, 'Laravel records terminal failure');
        $this->ensure(DB::table('jobs')->count() === 0, 'worker drains queue');
        $this->ensure(DB::table('prototype_records')->where('kind', 'root')->count() === 1, 'root Job succeeds');
        $this->ensure(DB::table('prototype_records')->where('kind', 'child')->count() === 1, 'child Job succeeds');
        $this->ensure(DB::table('prototype_records')->where('kind', 'retry')->count() === 2, 'retry Job executes twice');
        $this->ensure(DB::table('prototype_records')->where('kind', 'failure')->count() === 2, 'failure Job executes twice');
        $this->ensure(count(array_filter($sql, static fn (array $span) => Str::contains($span['attributes']['db.query.text'] ?? '', '?'))) > 0, 'SQL text stays parameterized');
        $this->ensure(! Str::contains(implode(' ', array_column(array_column($sql, 'attributes'), 'db.query.text')), ['root-ok', 'child-ok']), 'SQL bindings stay excluded');
        $this->ensure(! preg_match('/OpenTelemetry|App\\\\Telemetry|SkylinePrototype/', $jobSource), 'Jobs contain no telemetry calls');
        $this->ensure($this->allSqlParentsAreAttempts($sql, $consumers), 'SQL spans belong to active Attempts');
        $this->ensure($this->failureHasException($failure), 'terminal failure records exception details');

        return [
            'rows' => [
                ['Official OTel SDK', 'open-telemetry/sdk '.InstalledVersions::getPrettyVersion('open-telemetry/sdk')],
                ['Runs / Attempts / SQL spans', count($producers).' / '.count($consumers).' / '.count($sql)],
                ['Root trace hierarchy', 'producer → attempt → child producer → child attempt'],
                ['Retry outcomes', implode(' → ', $this->outcomes($retry))],
                ['Failure outcomes', implode(' → ', $this->outcomes($failure))],
                ['Root queue time', round($rootConsumer['attributes']['skyline.queue_time_ms']).'ms'],
                ['Job source telemetry calls', 'none'],
                ['External collector', 'none; dedicated SQLite exporter'],
                ['Laravel outcomes', 'root/child/retry succeeded; terminal failure persisted'],
            ],
            'graph' => [
                ['Root producer', $rootProducer['span_id'], $rootProducer['parent_span_id'] ?: 'none'],
                ['Root attempt', $rootConsumer['span_id'], $rootConsumer['parent_span_id']],
                ['Child producer', $childProducer['span_id'], $childProducer['parent_span_id']],
                ['Child attempt', $childConsumer['span_id'], $childConsumer['parent_span_id']],
            ],
            'trace_id' => $rootConsumer['trace_id'],
            'verdict' => 'YES — automatic trace capture works without Job changes or an external collector.',
        ];
    }

    /** @param array<string, mixed>|null $state */
    private function renderTui(?array $state, string $view): void
    {
        $this->output->write("\033[2J\033[H");
        $this->line("\033[1mSkyline automatic queue trace prototype\033[0m");
        $this->line("\033[2mReal Laravel database queue · official OTel SDK · disposable SQLite state\033[0m");
        $this->newLine();

        if ($state === null) {
            $this->line("\033[1mStatus\033[0m  Ready. Run the fixture to observe the complete state.");
        } elseif ($view === 'graph') {
            $this->line("\033[1mRoot Trace\033[0m  \033[2m{$state['trace_id']}\033[0m");
            $this->newLine();
            $this->table(['Span', 'ID', 'Parent'], $state['graph']);
        } else {
            $this->table(['Proof', 'Observed'], $state['rows']);
            $this->newLine();
            $this->info('VERDICT: '.$state['verdict']);
        }

        $this->newLine();
        $this->line("\033[1m[r]\033[0m \033[2mrun fixture\033[0m  \033[1m[g]\033[0m \033[2mtoggle trace graph\033[0m  \033[1m[q]\033[0m \033[2mquit\033[0m");
        $this->output->write('> ');
    }

    /** @param array<string, mixed> $state */
    private function renderOnce(array $state): void
    {
        $this->table(['Proof', 'Observed'], $state['rows']);
        $this->info('VERDICT: '.$state['verdict']);
    }

    /** @param list<array<string, mixed>> $spans
     * @return list<array<string, mixed>>
     */
    private function role(array $spans, string $role): array
    {
        return array_values(array_filter($spans, static fn (array $span) => ($span['attributes']['skyline.role'] ?? null) === $role));
    }

    /** @param list<array<string, mixed>> $spans
     * @return list<array<string, mixed>>
     */
    private function job(array $spans, string $job): array
    {
        $matches = array_values(array_filter($spans, static fn (array $span) => ($span['attributes']['laravel.job.name'] ?? null) === $job));
        usort($matches, static fn (array $left, array $right) => ($left['attributes']['skyline.attempt'] ?? 0) <=> ($right['attributes']['skyline.attempt'] ?? 0));

        return $matches;
    }

    /** @param list<array<string, mixed>> $spans
     * @return array<string, mixed>
     */
    private function oneJob(array $spans, string $job): array
    {
        $matches = $this->job($spans, $job);
        $this->ensure(count($matches) === 1, $job.' has one span');

        return $matches[0];
    }

    /** @param list<array<string, mixed>> $spans
     * @return list<string>
     */
    private function outcomes(array $spans): array
    {
        return array_values(array_map(static fn (array $span) => $span['attributes']['skyline.outcome'], $spans));
    }

    /** @param list<array<string, mixed>> $spans
     * @return list<int>
     */
    private function attempts(array $spans): array
    {
        return array_values(array_map(static fn (array $span) => $span['attributes']['skyline.attempt'], $spans));
    }

    /** @param list<array<string, mixed>> $sql
     * @param  list<array<string, mixed>>  $attempts
     */
    private function allSqlParentsAreAttempts(array $sql, array $attempts): bool
    {
        $attemptIds = array_column($attempts, 'span_id');

        return count(array_filter($sql, static fn (array $span) => ! in_array($span['parent_span_id'], $attemptIds, true))) === 0;
    }

    /** @param list<array<string, mixed>> $failure */
    private function failureHasException(array $failure): bool
    {
        $terminal = end($failure);

        return $terminal['status'] === 'Error'
            && count(array_filter($terminal['events'], static fn (array $event) => $event['name'] === 'exception')) > 0;
    }

    private function ensure(bool $condition, string $proof): void
    {
        if (! $condition) {
            throw new LogicException('Prototype failed: '.$proof);
        }
    }
}
