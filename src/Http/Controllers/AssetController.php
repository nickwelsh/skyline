<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Response;
use NickWelsh\Skyline\Support\AssetManifest;

final readonly class AssetController
{
    public function __construct(private AssetManifest $manifest) {}

    public function __invoke(string $asset): Response
    {
        $path = $this->manifest->path($asset);
        $contentType = match (pathinfo($path, PATHINFO_EXTENSION)) {
            'css' => 'text/css; charset=UTF-8',
            'js' => 'text/javascript; charset=UTF-8',
            'woff2' => 'font/woff2',
            default => 'application/octet-stream',
        };

        return response(file_get_contents($path), 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
