<?php

namespace NickWelsh\Skyline\Console;

use Illuminate\Console\Command;
use NickWelsh\Skyline\Persistence\FailureReporter;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Persistence\TracePruner;
use Throwable;

final class PruneCommand extends Command
{
    protected $signature = 'skyline:prune';

    protected $description = 'Prune expired Skyline Traces';

    public function handle(
        TracePruner $pruner,
        PersistenceGuard $guard,
        FailureReporter $failures,
    ): int {
        try {
            $deleted = $guard->run(fn (): int => $pruner->prune(
                max(0, (int) config('skyline.retention_hours', 24)),
                max(1, (int) config('skyline.prune.chunk_size', 500)),
            ));
            $this->components->info("Pruned {$deleted} Skyline Traces.");
        } catch (Throwable $exception) {
            $failures->report($exception);
        }

        return self::SUCCESS;
    }
}
