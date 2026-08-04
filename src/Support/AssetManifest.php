<?php

namespace NickWelsh\Skyline\Support;

use RuntimeException;

final class AssetManifest
{
    /** @var array<string, array{file: string, css?: list<string>}>|null */
    private ?array $manifest = null;

    public function __construct(private readonly string $path) {}

    /** @return array{file: string, css?: list<string>} */
    public function entry(string $name): array
    {
        $entry = $this->manifest()[$name] ?? null;

        if (! is_array($entry) || ! isset($entry['file'])) {
            throw new RuntimeException("Skyline asset entry [{$name}] is missing.");
        }

        return $entry;
    }

    public function path(string $asset): string
    {
        if (! in_array($asset, $this->assets(), true)) {
            abort(404);
        }

        $path = dirname($this->path).DIRECTORY_SEPARATOR.$asset;

        if (! is_file($path)) {
            throw new RuntimeException("Skyline asset [{$asset}] is missing.");
        }

        return $path;
    }

    /** @return list<string> */
    private function assets(): array
    {
        $assets = [];

        foreach ($this->manifest() as $entry) {
            $assets[] = $entry['file'];
            array_push($assets, ...($entry['css'] ?? []));
        }

        return array_values(array_unique($assets));
    }

    /** @return array<string, array{file: string, css?: list<string>}> */
    private function manifest(): array
    {
        if ($this->manifest !== null) {
            return $this->manifest;
        }

        if (! is_file($this->path)) {
            throw new RuntimeException('Skyline asset manifest is missing.');
        }

        $manifest = json_decode(file_get_contents($this->path), true, flags: JSON_THROW_ON_ERROR);

        if (! is_array($manifest)) {
            throw new RuntimeException('Skyline asset manifest is invalid.');
        }

        return $this->manifest = $manifest;
    }
}
