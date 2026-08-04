<?php

namespace NickWelsh\Skyline\Read;

use DateTimeImmutable;
use DateTimeZone;
use Exception;

final class Nanoseconds
{
    public static function now(): int
    {
        return (int) round(microtime(true) * 1_000_000_000);
    }

    public static function toRfc3339(?int $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $seconds = intdiv($value, 1_000_000_000);
        $nanoseconds = $value % 1_000_000_000;
        $date = (new DateTimeImmutable('@'.$seconds))->setTimezone(new DateTimeZone('UTC'));

        return $date->format('Y-m-d\TH:i:s').sprintf('.%09dZ', $nanoseconds);
    }

    public static function fromRfc3339(string $value): ?int
    {
        if (! preg_match(
            '/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/',
            $value,
            $matches,
        )) {
            return null;
        }

        try {
            $date = new DateTimeImmutable($matches[1].$matches[3]);
        } catch (Exception) {
            return null;
        }

        $nanoseconds = (int) str_pad($matches[2] ?? '', 9, '0');

        return ((int) $date->format('U') * 1_000_000_000) + $nanoseconds;
    }
}
