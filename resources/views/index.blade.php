<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Skyline</title>
    @foreach ($styles as $style)
        <link rel="stylesheet" href="{{ $style }}">
    @endforeach
</head>
<body>
    <div id="skyline" data-base-path="{{ $basePath }}"></div>
    <script type="module" src="{{ $script }}"></script>
</body>
</html>
