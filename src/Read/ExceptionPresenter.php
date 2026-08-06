<?php

namespace NickWelsh\Skyline\Read;

use NickWelsh\Skyline\Support\PrivacySanitizer;
use SplFileObject;
use Throwable;

final readonly class ExceptionPresenter
{
    private const FRAME_LIMIT = 100;

    public function __construct(private EditorLink $editorLink) {}

    /** @return array<string, mixed> */
    public function present(object $attempt, ?string $jobName): array
    {
        $sanitizer = new PrivacySanitizer;
        $message = $sanitizer->string(
            (string) $attempt->exception_message,
            max(1, (int) config('skyline.privacy.exception_message_bytes', 16_384)),
            'exception.message',
        );
        $lines = preg_split('/\R/', (string) $attempt->exception_trace) ?: [];
        $parsed = array_values(array_filter(array_map($this->parse(...), $lines)));
        $originFile = is_string($attempt->exception_file) && $attempt->exception_file !== ''
            ? $attempt->exception_file
            : null;
        $originCall = $parsed[0] ?? ['class' => null, 'type' => null, 'function' => 'throw'];
        $origin = $originFile === null ? [] : [[
            'rawFile' => $originFile,
            'line' => $attempt->exception_line === null ? null : (int) $attempt->exception_line,
            'class' => $originCall['class'],
            'type' => $originCall['type'],
            'function' => $originCall['function'],
        ]];
        $capturedFrames = [...$origin, ...$parsed];
        $frames = array_map(
            $this->frame(...),
            array_slice($capturedFrames, 0, self::FRAME_LIMIT),
        );
        $class = (string) $attempt->exception_class;
        $code = $attempt->exception_code === null ? null : (string) $attempt->exception_code;
        $location = $originFile === null ? null : $frames[0];

        return [
            'class' => $class,
            'message' => $message['value'],
            'messageTruncated' => $message['isTruncated'],
            'messageOriginalBytes' => $message['originalBytes'],
            'code' => $code,
            'location' => $location === null ? null : [
                'file' => $location['file'],
                'line' => $location['line'],
                'href' => $location['href'],
            ],
            'frames' => $frames,
            'framesTruncated' => count($capturedFrames) > self::FRAME_LIMIT,
            'markdown' => $this->markdown($class, $message['value'], $code, $jobName, $attempt, $frames),
        ];
    }

    /** @return array{rawFile: string, line: int|null, class: ?string, type: ?string, function: string}|null */
    private function parse(string $line): ?array
    {
        if (! preg_match('/^#\d+\s+(.+?)(?:\((\d+)\))?:\s+(.+)$/', $line, $matches)) {
            return null;
        }

        return [
            'rawFile' => $matches[1],
            'line' => isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : null,
            ...$this->call($matches[3]),
        ];
    }

    /** @param array{rawFile: string, line: int|null, class: ?string, type: ?string, function: string} $frame @return array<string, mixed> */
    private function frame(array $frame): array
    {
        $vendor = $this->isVendor($frame['rawFile']);

        return [
            'file' => $this->relativeFile($frame['rawFile']),
            'line' => $frame['line'],
            'class' => $frame['class'],
            'type' => $frame['type'],
            'function' => $frame['function'],
            'isVendor' => $vendor,
            'href' => $this->safeEditorHref($frame['rawFile'], $frame['line']),
            'snippet' => $vendor ? null : $this->snippet($frame['rawFile'], $frame['line']),
        ];
    }

    /** @return array{class: ?string, type: ?string, function: string} */
    private function call(string $call): array
    {
        $call = preg_replace('/\([^)]*\).*$/', '', $call) ?? $call;

        if (preg_match('/^(.+?)(::|->)([^:]+)$/', $call, $matches)) {
            return ['class' => $matches[1], 'type' => $matches[2], 'function' => $matches[3]];
        }

        return ['class' => null, 'type' => null, 'function' => $call];
    }

    /** @return array{code: string, startingLine: int, highlightedLine: int}|null */
    private function snippet(string $file, ?int $line): ?array
    {
        if ($line === null || $line < 1 || ! is_file($file) || ! is_readable($file)) {
            return null;
        }

        try {
            $startingLine = max(1, $line - 5);
            $source = new SplFileObject($file);
            $source->seek($startingLine - 1);
            $lines = [];

            while (! $source->eof() && count($lines) < 17) {
                $lines[] = $source->current();
                $source->next();
            }

            $code = implode('', $lines);

            return $code === '' ? null : [
                'code' => $code,
                'startingLine' => $startingLine,
                'highlightedLine' => $line,
            ];
        } catch (Throwable) {
            return null;
        }
    }

    private function isVendor(string $file): bool
    {
        $normalized = str_replace('\\', '/', $file);
        $base = rtrim(str_replace('\\', '/', base_path()), '/').'/';
        $packageTests = rtrim(str_replace('\\', '/', dirname(__DIR__, 2)), '/').'/tests/';

        if (str_starts_with($normalized, $base)) {
            return str_starts_with($normalized, $base.'vendor/');
        }

        if (str_starts_with($normalized, $packageTests) || str_contains($normalized, '/app/')) {
            return false;
        }

        return true;
    }

    private function relativeFile(string $file): string
    {
        $normalized = str_replace('\\', '/', $file);
        $base = rtrim(str_replace('\\', '/', base_path()), '/').'/';
        $package = rtrim(str_replace('\\', '/', dirname(__DIR__, 2)), '/').'/';

        foreach ([$base, $package] as $root) {
            if (str_starts_with($normalized, $root)) {
                return substr($normalized, strlen($root));
            }
        }

        foreach (['/app/', '/vendor/'] as $marker) {
            if (($position = strpos($normalized, $marker)) !== false) {
                return ltrim(substr($normalized, $position), '/');
            }
        }

        return basename($normalized);
    }

    private function safeEditorHref(string $file, ?int $line): ?string
    {
        $resolvedFile = realpath($file);
        $resolvedBase = realpath(base_path());

        if ($resolvedFile === false || $resolvedBase === false || ! is_readable($resolvedFile)) {
            return null;
        }

        $normalizedFile = str_replace('\\', '/', $resolvedFile);
        $normalizedBase = rtrim(str_replace('\\', '/', $resolvedBase), '/').'/';

        if (! str_starts_with($normalizedFile, $normalizedBase)) {
            return null;
        }

        $editor = config('app.editor');
        if ($editor === '' || $editor === [] || $editor === null) {
            $editor = config('skyline.editor');
        }

        if (! is_array($editor) || ! is_string($editor['base_path'] ?? null) || $editor['base_path'] === '') {
            return null;
        }

        $relativeFile = substr($normalizedFile, strlen($normalizedBase));
        $lexicalFile = rtrim(str_replace('\\', '/', base_path()), '/').'/'.$relativeFile;

        return $this->editorLink->href($lexicalFile, $line);
    }

    /** @param list<array<string, mixed>> $frames */
    private function markdown(string $class, string $message, ?string $code, ?string $jobName, object $attempt, array $frames): string
    {
        $lines = [
            "# {$class} - Job failed",
            '',
            $message,
        ];

        if ($jobName !== null) {
            $lines[] = '';
            $lines[] = 'Job '.$jobName;
        }

        $lines[] = 'Run '.$attempt->run_id;
        $lines[] = 'Attempt '.(int) $attempt->attempt_number;

        if ($code !== null && $code !== '') {
            $lines[] = 'Code '.$code;
        }

        $lines[] = '';
        $lines[] = '## Stack Trace';
        $lines[] = '';

        foreach ($frames as $index => $frame) {
            $lines[] = $index.' - '.$frame['file'].':'.($frame['line'] ?? 0);
        }

        return implode("\n", $lines)."\n";
    }
}
