<?php

namespace NickWelsh\Skyline\Telemetry;

use BackedEnum;
use DateTimeInterface;
use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;
use Stringable;

final class ValueCapture
{
    public function encode(mixed $value, int $maxBytes): string
    {
        $type = get_debug_type($value);
        $normalized = $this->normalize($value);
        $encoded = $this->json($normalized);
        $originalBytes = strlen($encoded);
        $limit = max(256, $maxBytes);
        $truncated = $originalBytes > $limit;

        if ($truncated) {
            $normalized = mb_strcut($encoded, 0, $limit, 'UTF-8');
        }

        return $this->json([
            'type' => $type,
            'value' => $normalized,
            'originalBytes' => $originalBytes,
            'truncated' => $truncated,
        ]);
    }

    private function normalize(mixed $value, int $depth = 0): mixed
    {
        if ($depth > 8) {
            return '[MAX DEPTH]';
        }

        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if (is_string($value)) {
            return preg_match('//u', $value) === 1 ? $value : '[BINARY '.strlen($value).' BYTES]';
        }

        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if ($value instanceof Arrayable) {
            return $this->normalize($value->toArray(), $depth + 1);
        }

        if ($value instanceof JsonSerializable) {
            return $this->normalize($value->jsonSerialize(), $depth + 1);
        }

        if ($value instanceof Stringable) {
            return $this->normalize((string) $value, $depth + 1);
        }

        if (is_object($value)) {
            $properties = get_object_vars($value);

            return $properties === []
                ? '['.$value::class.']'
                : $this->normalize($properties, $depth + 1);
        }

        if (is_array($value)) {
            $normalized = [];

            foreach ($value as $key => $item) {
                $normalized[mb_strcut((string) $key, 0, 512, 'UTF-8')] = $this->normalize($item, $depth + 1);
            }

            return array_is_list($value) ? array_values($normalized) : $normalized;
        }

        return '['.strtoupper(get_debug_type($value)).']';
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }
}
