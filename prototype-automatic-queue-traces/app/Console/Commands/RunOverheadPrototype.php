<?php

namespace App\Console\Commands;

use App\Jobs\BenchmarkNoopJob;
use App\Jobs\BenchmarkSqlJob;
use App\Jobs\BenchmarkWorkJob;
use App\Telemetry\SkylinePrototype;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use LogicException;

final class RunOverheadPrototype extends Command
{
    private const JOBS = 100;

    private const TRIALS = 7;

    private const WARMUP_JOBS = 10;

    protected $signature = 'skyline:overhead {--once : Run once without the interactive shell}';

    protected $description = 'Measure automatic capture and SQL persistence overhead';

    public function handle(SkylinePrototype $skyline): int
    {
        if ($this->option('once')) {
            $this->renderOnce($this->benchmark($skyline));

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
                $state = $this->benchmark($skyline);
                $view = 'summary';
            }

            if ($key === 'd' && $state !== null) {
                $view = $view === 'summary' ? 'detail' : 'summary';
            }
        }
    }

    /** @return array{summary: list<list<string>>, detail: list<list<string>>, results: list<array<string, mixed>>} */
    private function benchmark(SkylinePrototype $skyline): array
    {
        $results = [];

        foreach ($this->scenarios() as $scenario => $label) {
            $this->runVariant($skyline, $scenario, self::WARMUP_JOBS, false);
            $this->runVariant($skyline, $scenario, self::WARMUP_JOBS, true);
            $trials = ['baseline' => [], 'monitored' => []];
            $lastSpans = [];

            for ($trial = 0; $trial < self::TRIALS; $trial++) {
                $order = $trial % 2 === 0 ? [false, true] : [true, false];

                foreach ($order as $monitored) {
                    $run = $this->runVariant($skyline, $scenario, self::JOBS, $monitored);
                    $key = $monitored ? 'monitored' : 'baseline';
                    $trials[$key][] = $run['milliseconds'];

                    if ($monitored) {
                        $lastSpans = $run['spans'];
                    }
                }
            }

            $baseline = $this->median($trials['baseline']) / self::JOBS;
            $monitored = $this->median($trials['monitored']) / self::JOBS;
            $added = $monitored - $baseline;
            $sqlSpans = count(array_filter($lastSpans, static fn (array $span) => ($span['attributes']['skyline.role'] ?? null) === 'sql'));
            $results[] = [
                'scenario' => $scenario,
                'label' => $label,
                'baseline' => $baseline,
                'monitored' => $monitored,
                'added' => $added,
                'percent' => $added / $baseline * 100,
                'spans_per_job' => count($lastSpans) / self::JOBS,
                'sql_per_job' => $sqlSpans / self::JOBS,
                'trials' => $trials,
            ];
        }

        $skyline->enable();

        return [
            'summary' => array_map(static fn (array $result) => [
                $result['label'],
                number_format($result['baseline'], 3),
                number_format($result['monitored'], 3),
                number_format($result['added'], 3),
                number_format($result['percent'], 1).'%',
                number_format($result['spans_per_job'], 1),
                number_format($result['sql_per_job'], 1),
            ], $results),
            'detail' => $this->detail($results),
            'results' => $results,
        ];
    }

    /** @return array{milliseconds: float, spans: list<array<string, mixed>>} */
    private function runVariant(SkylinePrototype $skyline, string $scenario, int $jobs, bool $monitored): array
    {
        $skyline->reset();
        $monitored ? $skyline->enable() : $skyline->disable();
        DB::table('jobs')->delete();
        DB::table('failed_jobs')->delete();
        gc_collect_cycles();
        $start = hrtime(true);

        for ($job = 0; $job < $jobs; $job++) {
            match ($scenario) {
                'noop' => BenchmarkNoopJob::dispatch(),
                'sql' => BenchmarkSqlJob::dispatch(),
                'work' => BenchmarkWorkJob::dispatch(),
            };
        }

        $this->callSilently('queue:work', [
            'connection' => 'database',
            '--queue' => 'default',
            '--stop-when-empty' => true,
            '--tries' => 1,
            '--sleep' => 0,
        ]);
        $milliseconds = (hrtime(true) - $start) / 1_000_000;
        $this->ensure(DB::table('jobs')->count() === 0, 'worker drains every benchmark Job');

        return [
            'milliseconds' => $milliseconds,
            'spans' => $monitored ? $skyline->spans() : [],
        ];
    }

    /** @return array<string, string> */
    private function scenarios(): array
    {
        return [
            'noop' => 'No-op',
            'sql' => '10 SQL',
            'work' => 'CPU + 3 SQL',
        ];
    }

    /** @param list<float> $values */
    private function median(array $values): float
    {
        sort($values);

        return $values[(int) floor(count($values) / 2)];
    }

    /** @param list<array<string, mixed>> $results
     * @return list<list<string>>
     */
    private function detail(array $results): array
    {
        $rows = [];

        foreach ($results as $result) {
            for ($trial = 0; $trial < self::TRIALS; $trial++) {
                $rows[] = [
                    $result['label'],
                    (string) ($trial + 1),
                    number_format($result['trials']['baseline'][$trial] / self::JOBS, 3),
                    number_format($result['trials']['monitored'][$trial] / self::JOBS, 3),
                ];
            }
        }

        return $rows;
    }

    /** @param array<string, mixed>|null $state */
    private function renderTui(?array $state, string $view): void
    {
        $this->output->write("\033[2J\033[H");
        $this->line("\033[1mSkyline telemetry overhead prototype\033[0m");
        $this->line("\033[2m7 alternating trials · 100 Jobs each · capture every Run · dedicated SQLite persistence\033[0m");
        $this->newLine();

        if ($state === null) {
            $this->line("\033[1mStatus\033[0m  Ready. Benchmark takes roughly 20 seconds.");
        } elseif ($view === 'detail') {
            $this->table(['Workload', 'Trial', 'Base ms/Job', 'Monitored ms/Job'], $state['detail']);
        } else {
            $this->table(
                ['Workload', 'Base ms', 'Monitored ms', 'Added ms', 'Overhead', 'Spans/Job', 'SQL/Job'],
                $state['summary'],
            );
        }

        $this->newLine();
        $this->line("\033[1m[r]\033[0m \033[2mrun benchmark\033[0m  \033[1m[d]\033[0m \033[2mtoggle raw trials\033[0m  \033[1m[q]\033[0m \033[2mquit\033[0m");
        $this->output->write('> ');
    }

    /** @param array<string, mixed> $state */
    private function renderOnce(array $state): void
    {
        $this->table(
            ['Workload', 'Base ms', 'Monitored ms', 'Added ms', 'Overhead', 'Spans/Job', 'SQL/Job'],
            $state['summary'],
        );
        $this->newLine();
        $this->table(['Workload', 'Trial', 'Base ms/Job', 'Monitored ms/Job'], $state['detail']);
    }

    private function ensure(bool $condition, string $proof): void
    {
        if (! $condition) {
            throw new LogicException('Benchmark failed: '.$proof);
        }
    }
}
