<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;

final class QueueTargetEligibility
{
    public static function apply(Builder $query, string $table = 'skyline_runs'): Builder
    {
        return $query
            ->whereNotNull("{$table}.connection")
            ->whereNotNull("{$table}.queue")
            ->where("{$table}.connection", '<>', 'sync')
            ->where("{$table}.connection", '<>', '')
            ->where("{$table}.queue", '<>', '');
    }
}
