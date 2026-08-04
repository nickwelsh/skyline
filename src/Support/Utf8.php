<?php

namespace NickWelsh\Skyline\Support;

final class Utf8
{
    public static function truncate(string $value, int $bytes): string
    {
        if (strlen($value) <= $bytes) {
            return $value;
        }

        $value = substr($value, 0, max(0, $bytes));

        while ($value !== '' && preg_match('//u', $value) !== 1) {
            $value = substr($value, 0, -1);
        }

        return $value;
    }
}
