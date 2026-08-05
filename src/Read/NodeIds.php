<?php

namespace NickWelsh\Skyline\Read;

final class NodeIds
{
    public static function run(string $runId): string
    {
        return 'run_'.$runId;
    }

    public static function attempt(string $runId, int $attempt): string
    {
        return 'attempt_'.$runId.'_'.$attempt;
    }

    public static function span(string $spanId): string
    {
        return 'span_'.$spanId;
    }

    public static function breadcrumb(string $spanId, int $event): string
    {
        return 'breadcrumb_'.$spanId.'_'.$event;
    }
}
