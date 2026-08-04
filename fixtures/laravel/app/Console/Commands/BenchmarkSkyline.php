<?php

namespace App\Console\Commands;

use App\Jobs\BenchmarkNoopJob;
use App\Jobs\BenchmarkSqlJob;
use App\Jobs\BenchmarkWorkJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use LogicException;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Telemetry\QueueInstrumentation;

final class BenchmarkSkyline extends Command
{
    private const JOBS = 100;

    private const TRIALS = 7;

    private const WARMUP_JOBS = 10;

    protected $signature = 'skyline:benchmark';

    protected $description = 'Run the approved alternating Skyline overhead gate';

    public function handle(
        QueueInstrumentation $instrumentation,
        PersistentTelemetrySink $sink,
    ): int {
        $failed = false;
        $this->table(
            ['Workload', 'Base ms', 'Skyline ms', 'Added ms', 'Overhead', 'SQL/Job', 'Gate'],
            array_map(function (string $label, string $workload) use ($instrumentation, $sink, &$failed): array {
                $this->runVariant($workload, self::WARMUP_JOBS, false, $instrumentation, $sink);
                $this->runVariant($workload, self::WARMUP_JOBS, true, $instrumentation, $sink);
                $samples = ['baseline' => [], 'skyline' => []];
                $sqlPerJob = 0.0;

                for ($trial = 0; $trial < self::TRIALS; $trial++) {
                    foreach ($trial % 2 === 0 ? [false, true] : [true, false] as $enabled) {
                        $result = $this->runVariant($workload, self::JOBS, $enabled, $instrumentation, $sink);
                        $samples[$enabled ? 'skyline' : 'baseline'][] = $result['milliseconds_per_job'];

                        if ($enabled) {
                            $sqlPerJob = $result['sql_spans_per_job'];
                        }
                    }
                }

                $baseline = $this->median($samples['baseline']);
                $skyline = $this->median($samples['skyline']);
                $added = $skyline - $baseline;
                $relative = $added / $baseline * 100;
                $passed = $added <= 0.8 + 0.1 * $sqlPerJob
                    && ($baseline < 10 || $relative <= 10);
                $failed = $failed || ! $passed;

                return [
                    $label,
                    number_format($baseline, 3),
                    number_format($skyline, 3),
                    number_format($added, 3),
                    number_format($relative, 1).'%',
                    number_format($sqlPerJob, 1),
                    $passed ? 'PASS' : 'FAIL',
                ];
            }, $this->workloads(), array_keys($this->workloads())),
        );
        $instrumentation->enable();

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    /** @return array{milliseconds_per_job: float, sql_spans_per_job: float} */
    private function runVariant(
        string $workload,
        int $jobs,
        bool $enabled,
        QueueInstrumentation $instrumentation,
        PersistentTelemetrySink $sink,
    ): array {
        $sink->flush();
        $enabled ? $instrumentation->enable() : $instrumentation->disable();

        foreach (['skyline_spans', 'skyline_attempts', 'skyline_runs', 'skyline_traces', 'jobs', 'failed_jobs'] as $table) {
            DB::table($table)->delete();
        }

        $job = match ($workload) {
            'noop' => BenchmarkNoopJob::class,
            'sql' => BenchmarkSqlJob::class,
            'work' => BenchmarkWorkJob::class,
            default => throw new LogicException('Unknown workload.'),
        };
        gc_collect_cycles();
        $started = hrtime(true);

        for ($index = 0; $index < $jobs; $index++) {
            $job::dispatch();
        }

        $worker = $this->callSilently('queue:work', [
            'connection' => 'database',
            '--queue' => 'default',
            '--stop-when-empty' => true,
            '--tries' => 1,
            '--sleep' => 0,
        ]);
        $sink->flush();
        $milliseconds = (hrtime(true) - $started) / 1_000_000;

        if ($worker !== self::SUCCESS || DB::table('jobs')->count() !== 0) {
            throw new LogicException('Benchmark worker did not drain the queue.');
        }

        return [
            'milliseconds_per_job' => $milliseconds / $jobs,
            'sql_spans_per_job' => $enabled
                ? DB::table('skyline_spans')->where('role', 'sql')->count() / $jobs
                : 0.0,
        ];
    }

    /** @return array<string, string> */
    private function workloads(): array
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
}
