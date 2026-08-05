<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Contracts\Config\Repository;

final readonly class EditorLink
{
    /** @var array<string, string> */
    private const HREFS = [
        'cursor' => 'cursor://file/{file}:{line}',
        'phpstorm' => 'phpstorm://open?file={file}&line={line}',
        'vscode' => 'vscode://file/{file}:{line}',
        'zed' => 'zed://file/{file}:{line}',
    ];

    public function __construct(private Repository $config) {}

    public function href(string $file, ?int $line): ?string
    {
        $editor = $this->config->get('app.editor') ?? $this->config->get('skyline.editor');

        if ($editor === '' || $editor === []) {
            $editor = $this->config->get('skyline.editor');
        }

        if (! is_string($editor) && ! is_array($editor)) {
            return null;
        }

        $name = is_array($editor) ? ($editor['name'] ?? null) : $editor;
        $template = is_array($editor) ? ($editor['href'] ?? null) : null;

        if (! is_string($template)) {
            if (! is_string($name) || $name === '') {
                return null;
            }

            $template = self::HREFS[$name] ?? "{$name}://open?file={file}&line={line}";
        }

        $mappedFile = $this->mappedFile($file, is_array($editor) ? ($editor['base_path'] ?? null) : null);

        return str_replace(['{file}', '{line}'], [$mappedFile, (string) ($line ?? 1)], $template);
    }

    private function mappedFile(string $file, mixed $editorBasePath): string
    {
        if (! is_string($editorBasePath) || $editorBasePath === '') {
            return $file;
        }

        $base = rtrim(str_replace('\\', '/', base_path()), '/');

        return str_starts_with($file, $base)
            ? rtrim($editorBasePath, '/').substr($file, strlen($base))
            : $file;
    }
}
