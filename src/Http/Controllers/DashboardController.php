<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Contracts\View\View;
use NickWelsh\Skyline\Support\AssetManifest;

final readonly class DashboardController
{
    public function __construct(private AssetManifest $manifest) {}

    public function __invoke(): View
    {
        $entry = $this->manifest->entry('resources/js/app.tsx');

        return view('skyline::index', [
            'script' => route('skyline.asset', ['asset' => $entry['file']]),
            'styles' => array_map(
                fn (string $asset): string => route('skyline.asset', ['asset' => $asset]),
                $entry['css'] ?? [],
            ),
        ]);
    }
}
