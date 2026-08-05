<?php

namespace NickWelsh\Skyline\Telemetry;

use BackedEnum;
use DateTimeInterface;
use Illuminate\Contracts\Config\Repository;
use JsonSerializable;
use Stringable;
use Throwable;

final class SqlResultRegistry
{
    /** @var array{query: string, preview: array<string, mixed>}|null */
    private ?array $pending = null;

    public function __construct(private readonly Repository $config) {}

    /** @param array<int, mixed> $rows */
    public function recordRows(string $query, array $rows): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            $limit = max(1, (int) $this->config->get('skyline.sql.max_result_rows', 25));
            $preview = [
                'kind' => 'rows',
                'rows' => array_map(
                    fn (mixed $row): mixed => $this->normalize($row),
                    array_slice($rows, 0, $limit),
                ),
                'rowCount' => count($rows),
                'truncated' => count($rows) > $limit,
            ];

            $this->pending = [
                'query' => $query,
                'preview' => $this->fit($preview, 'rows', $this->resultBytes()),
            ];
        } catch (Throwable) {
            $this->pending = null;
        }
    }

    public function recordAffected(string $query, int $rows): void
    {
        if (! $this->enabled()) {
            return;
        }

        $this->pending = [
            'query' => $query,
            'preview' => [
                'kind' => 'affected',
                'affectedRows' => max(0, $rows),
                'truncated' => false,
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public function consume(string $query): ?array
    {
        $pending = $this->pending;
        $this->pending = null;

        return $pending !== null && hash_equals($pending['query'], $query)
            ? $pending['preview']
            : null;
    }

    private function normalize(mixed $value, ?string $key = null, int $depth = 0): mixed
    {
        if ($key !== null && $this->sensitive($key)) {
            return '[REDACTED]';
        }

        if ($depth > 8) {
            return '[MAX DEPTH]';
        }

        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if (is_string($value)) {
            return preg_match('//u', $value) === 1
                ? mb_strcut($value, 0, 4_096, 'UTF-8')
                : '[BINARY '.strlen($value).' BYTES]';
        }

        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if ($value instanceof JsonSerializable) {
            return $this->normalize($value->jsonSerialize(), $key, $depth + 1);
        }

        if ($value instanceof Stringable) {
            return $this->normalize((string) $value, $key, $depth + 1);
        }

        if (is_object($value)) {
            $value = get_object_vars($value);
        }

        if (is_array($value)) {
            $result = [];

            foreach ($value as $itemKey => $item) {
                $safeKey = mb_strcut((string) $itemKey, 0, 512, 'UTF-8');
                $result[$safeKey] = $this->normalize($item, $safeKey, $depth + 1);
            }

            return $result;
        }

        return '['.strtoupper(get_debug_type($value)).']';
    }

    /** @param array<string, mixed> $preview @return array<string, mixed> */
    private function fit(array $preview, string $list, int $bytes): array
    {
        while ($preview[$list] !== [] && strlen($this->json($preview)) > $bytes) {
            array_pop($preview[$list]);
            $preview['truncated'] = true;
        }

        return $preview;
    }

    private function sensitive(string $column): bool
    {
        $column = strtolower($column);

        foreach ((array) $this->config->get('skyline.sql.redact_columns', []) as $pattern) {
            if (is_string($pattern) && $pattern !== '' && str_contains($column, strtolower($pattern))) {
                return true;
            }
        }

        return false;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    private function enabled(): bool
    {
        return (bool) $this->config->get('skyline.sql.capture_results', false);
    }

    private function resultBytes(): int
    {
        return max(256, (int) $this->config->get('skyline.sql.max_result_bytes', 65_536));
    }
}
