<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Skyline</title>
    <script data-skyline-prepaint>
        {!! $prepaint !!}
        window.__skylineUiPreferences.prepaint(@json($bootstrap['basePath']));
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
