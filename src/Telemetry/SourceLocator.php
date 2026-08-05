<?php

namespace NickWelsh\Skyline\Telemetry;

final class SourceLocator
{
    /** @return array{file: string, line: int}|null */
    public function locate(): ?array
    {
        $packageSource = rtrim(str_replace('\\', '/', dirname(__DIR__)), '/').'/';

        foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 60) as $frame) {
            $file = isset($frame['file']) ? str_replace('\\', '/', $frame['file']) : null;

            if ($file === null
                || ! isset($frame['line'])
                || str_contains($file, '/vendor/')
                || str_starts_with($file, $packageSource)
            ) {
                continue;
            }

            return ['file' => $file, 'line' => (int) $frame['line']];
        }

        return null;
    }

    /** @return array<string, string|int> */
    public function attributes(string $prefix): array
    {
        $source = $this->locate();

        return $source === null ? [] : [
            $prefix.'.file' => $source['file'],
            $prefix.'.line' => $source['line'],
        ];
    }
}
