<?php

namespace NickWelsh\Skyline\Http\Controllers;

use NickWelsh\Skyline\Read\Capabilities;
use NickWelsh\Skyline\Support\AssetManifest;
use Symfony\Component\HttpFoundation\Response;

final readonly class DashboardController
{
    public function __construct(
        private AssetManifest $manifest,
        private Capabilities $capabilities,
    ) {}

    public function __invoke(): Response
    {
        $entry = $this->manifest->entry('resources/js/app.tsx');

        return response()->view('skyline::index', [
            'bootstrap' => [
                'schemaVersion' => 1,
                'basePath' => '/'.trim((string) config('skyline.path', 'skyline'), '/'),
                'applicationName' => (string) config('app.name', 'Laravel'),
                'environmentLabel' => app()->environment(),
                'capabilities' => $this->capabilities->all(),
            ],
            'script' => route('skyline.asset', ['asset' => $entry['file']]),
            'prepaint' => file_get_contents(__DIR__.'/../../../resources/js/skyline/uiPreferencesPrepaint.js'),
            'styles' => array_map(
                fn (string $asset): string => route('skyline.asset', ['asset' => $asset]),
                $entry['css'] ?? [],
            ),
        ])->header('Cache-Control', 'private, no-store');
    }
}
