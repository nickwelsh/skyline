<?php

namespace App\Console\Commands;

use App\Jobs\FailingJob;
use App\Jobs\ParentJob;
use App\Jobs\RetryingJob;
use App\Jobs\SuccessfulJob;
use Illuminate\Console\Command;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use LogicException;
use NickWelsh\Skyline\Persistence\PersistentTelemetrySink;
use NickWelsh\Skyline\Persistence\TracePruner;

final class ProveSkyline extends Command
{
    protected $signature = 'skyline:prove';

    protected $description = 'Prove the installed Skyline MVP against unchanged queued Jobs';

    public function handle(TracePruner $pruner, Kernel $http): int
    {
        $this->resetState();

        SuccessfulJob::dispatch();
        ParentJob::dispatch();
        RetryingJob::dispatch();
        FailingJob::dispatch();

        $worker = $this->callSilently('queue:work', [
            'connection' => 'database',
            '--queue' => 'default',
            '--stop-when-empty' => true,
            '--tries' => 3,
            '--backoff' => 0,
            '--sleep' => 0,
        ]);

        $this->ensure($worker === self::SUCCESS, 'the standard queue worker exits successfully');
        app(PersistentTelemetrySink::class)->flush();
        $this->ensure(DB::table('jobs')->count() === 0, 'the queue drains');
        $this->ensure(DB::table('failed_jobs')->count() === 1, 'Laravel records one terminal failure');
        $this->ensure(DB::table('proof_records')->where('kind', 'successful')->count() === 1, 'the successful Job stays successful');
        $this->ensure(DB::table('proof_records')->where('kind', 'parent')->count() === 1, 'the parent Job stays successful');
        $this->ensure(DB::table('proof_records')->where('kind', 'child')->count() === 1, 'the child Job stays successful');
        $this->ensure(DB::table('proof_records')->where('kind', 'retry')->count() === 2, 'the retrying Job executes twice');
        $this->ensure(DB::table('proof_records')->where('kind', 'failure')->count() === 3, 'the failing Job executes three times');

        $runs = DB::table('skyline_runs')->orderBy('triggered_at')->get();
        $attempts = DB::table('skyline_attempts')->get();
        $sql = DB::table('skyline_spans')->where('role', 'sql')->get();
        $statuses = $runs->groupBy('job_name')->map->pluck('status')->map->values();

        $this->ensure($runs->count() === 5, 'five Runs are captured');
        $this->ensure($attempts->count() === 8, 'eight Attempts are captured');
        $this->ensure($sql->isNotEmpty(), 'application SQL is captured');
        $this->ensure($statuses->get(SuccessfulJob::class)?->all() === ['completed'], 'successful status is completed');
        $this->ensure($statuses->get(RetryingJob::class)?->all() === ['completed'], 'retry status becomes completed');
        $this->ensure($statuses->get(FailingJob::class)?->all() === ['failed'], 'failure status is terminal');
        $this->ensure($attempts->where('run_id', $runs->firstWhere('job_name', FailingJob::class)->run_id)->count() === 3, 'terminal failure records three Attempts');

        $capturedSql = $sql->pluck('attributes')->implode(' ');
        $this->ensure(str_contains($capturedSql, '?'), 'captured SQL remains parameterized');
        $this->ensure(! str_contains($capturedSql, '-secret'), 'SQL bindings stay excluded');

        $jobSource = implode('', array_map('file_get_contents', glob(app_path('Jobs/*Job.php')) ?: []));
        $this->ensure(! preg_match('/NickWelsh\\\\Skyline|OpenTelemetry/', $jobSource), 'Jobs contain no monitoring calls');

        $dashboard = $this->request($http, '/skyline');
        $this->ensure($dashboard['status'] === 200 && str_contains($dashboard['body'], 'Skyline'), 'the dashboard is served');
        $list = $this->request($http, '/skyline/api/runs');
        $this->ensure($list['status'] === 200, 'the Run API is served');
        $listedRuns = json_decode($list['body'], true, flags: JSON_THROW_ON_ERROR)['runs'];
        $this->ensure(count($listedRuns) === 5, 'the Run API lists every Run');

        foreach ($listedRuns as $run) {
            $detail = $this->request($http, '/skyline/api/runs/'.$run['id']);
            $this->ensure($detail['status'] === 200, 'every Run is inspectable');
        }

        $expired = $runs->firstWhere('job_name', SuccessfulJob::class);
        $beforePrune = DB::table('skyline_traces')->count();
        DB::table('skyline_traces')->where('trace_id', $expired->trace_id)->update([
            'last_activity_at' => $this->now() - 25 * 3_600_000_000_000,
        ]);
        $pruned = $pruner->prune(24, 1, $this->now());
        $this->ensure($pruned === 1, 'one expired terminal Trace is pruned');
        $this->ensure(DB::table('skyline_traces')->count() === $beforePrune - 1, 'current Traces are retained');
        $this->ensure(DB::table('skyline_runs')->where('run_id', $expired->run_id)->doesntExist(), 'pruning cascades whole Trace data');

        $this->table(['Proof', 'Observed'], [
            ['Runtime', PHP_VERSION.' / Laravel '.app()->version()],
            ['Runs / Attempts / SQL', $runs->count().' / '.$attempts->count().' / '.$sql->count()],
            ['Outcomes', 'successful, child, retry→success, terminal failure'],
            ['Interface', '/skyline and every Run detail returned 200'],
            ['Privacy', 'parameterized SQL; bindings absent'],
            ['Pruning', 'expired Trace removed; current Traces retained'],
        ]);
        $this->components->info('Skyline MVP proof passed.');

        return self::SUCCESS;
    }

    private function resetState(): void
    {
        foreach (['skyline_spans', 'skyline_attempts', 'skyline_runs', 'skyline_traces', 'jobs', 'failed_jobs', 'proof_records'] as $table) {
            DB::table($table)->delete();
        }
    }

    /** @return array{status: int, body: string} */
    private function request(Kernel $http, string $uri): array
    {
        $request = Request::create($uri, 'GET', server: ['HTTP_ACCEPT' => 'application/json']);
        $response = $http->handle($request);
        $result = ['status' => $response->getStatusCode(), 'body' => (string) $response->getContent()];
        $http->terminate($request, $response);

        return $result;
    }

    private function now(): int
    {
        return (int) round(microtime(true) * 1_000_000_000);
    }

    private function ensure(bool $condition, string $proof): void
    {
        if (! $condition) {
            throw new LogicException('MVP proof failed: '.$proof);
        }
    }
}
