<?php

namespace NickWelsh\Skyline\Read;

use NickWelsh\Skyline\Support\Utf8;

final class PrivacySanitizer
{
    private int $remaining;

    /** @var list<array{path: string, originalBytes: int}> */
    private array $truncated = [];

    public function __construct()
    {
        $this->remaining = $this->totalLimit();
    }

    /** @param array<string, mixed> $value @return array{value: array<string, mixed>, isTruncated: bool, truncated: list<array{path: string, originalBytes: int}>} */
    public function metadata(array $value): array
    {
        $sanitized = $this->walk($value, 'metadata', 0);

        return [
            'value' => is_array($sanitized) ? $sanitized : [],
            'isTruncated' => $this->truncated !== [],
            'truncated' => $this->truncated,
        ];
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    public function attributes(array $attributes): array
    {
        return array_filter(
            $attributes,
            fn (mixed $value, string|int $key): bool => is_string($key) && $this->allowedAttribute($key),
            ARRAY_FILTER_USE_BOTH,
        );
    }

    public function string(string $value, int $limit, string $path): array
    {
        $original = strlen($value);
        $available = max(0, min($limit, $this->remaining));
        $result = $original > $available ? Utf8::truncate($value, $available) : $value;
        $this->remaining -= strlen($result);

        if ($original > strlen($result)) {
            $this->truncated[] = ['path' => $path, 'originalBytes' => $original];
        }

        return [
            'value' => $result,
            'isTruncated' => $original > strlen($result),
            'originalBytes' => $original,
        ];
    }

    private function walk(mixed $value, string $path, int $depth): mixed
    {
        if ($depth > 8 || $this->remaining <= 0) {
            $this->truncated[] = ['path' => $path, 'originalBytes' => is_string($value) ? strlen($value) : 0];

            return null;
        }

        if (is_string($value)) {
            return $this->string($value, $this->stringLimit(), $path)['value'];
        }

        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
            return $value;
        }

        if (! is_array($value)) {
            return (string) $value;
        }

        $result = [];

        foreach ($value as $key => $item) {
            if ($this->remaining <= 0) {
                $this->truncated[] = ['path' => $path, 'originalBytes' => 0];
                break;
            }

            $safeKey = substr((string) $key, 0, 512);
            $result[$safeKey] = $this->walk($item, $path.'.'.$safeKey, $depth + 1);
        }

        return $result;
    }

    private function allowedAttribute(string $key): bool
    {
        if ($key === 'exception.stacktrace') {
            return false;
        }

        foreach (['skyline.', 'db.', 'messaging.', 'laravel.', 'exception.type'] as $prefix) {
            if (str_starts_with($key, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function stringLimit(): int
    {
        return max(1, (int) config('skyline.privacy.metadata_string_bytes', 65_536));
    }

    private function totalLimit(): int
    {
        return max(1, (int) config('skyline.privacy.metadata_total_bytes', 262_144));
    }
}
