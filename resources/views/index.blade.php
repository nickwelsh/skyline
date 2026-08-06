<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Skyline</title>
    <script data-skyline-prepaint>
        (() => {
            const fallback = { theme: 'classic', contrast: 50 };
            try {
                const stored = JSON.parse(localStorage.getItem(@json('skyline.ui-preferences.v1:'.$bootstrap['basePath'])) || 'null') || fallback;
                const theme = ['classic', 'system', 'dark', 'light'].includes(stored.theme) ? stored.theme : fallback.theme;
                document.documentElement.dataset.theme = theme === 'system'
                    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                const contrast = Number.isInteger(stored.contrast) && stored.contrast >= 0 && stored.contrast <= 100 ? stored.contrast : fallback.contrast;
                document.documentElement.style.setProperty('--theme-contrast', String(contrast / 100));
            } catch {
                document.documentElement.dataset.theme = fallback.theme;
                document.documentElement.style.setProperty('--theme-contrast', String(fallback.contrast / 100));
            }
        })();
    </script>
    @foreach ($styles as $style)
        <link rel="stylesheet" href="{{ $style }}">
    @endforeach
</head>
<body>
    <div id="skyline"></div>
    <script id="skyline-bootstrap" type="application/json">{!! json_encode($bootstrap, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) !!}</script>
    <script type="module" src="{{ $script }}"></script>
</body>
</html>
