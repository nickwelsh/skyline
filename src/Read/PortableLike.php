<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Database\Query\Builder;

final class PortableLike
{
    private const ESCAPE = '!';

    public static function whereContains(Builder $query, string $expression, string $literal): Builder
    {
        return $query->whereRaw(self::clause($expression), ['%'.self::escape($literal).'%']);
    }

    public static function orWherePrefix(Builder $query, string $expression, string $literal): Builder
    {
        return $query->orWhereRaw(self::clause($expression), [self::escape($literal).'%']);
    }

    private static function clause(string $expression): string
    {
        return "{$expression} LIKE ? ESCAPE '".self::ESCAPE."'";
    }

    private static function escape(string $literal): string
    {
        return str_replace(
            [self::ESCAPE, '%', '_'],
            [self::ESCAPE.self::ESCAPE, self::ESCAPE.'%', self::ESCAPE.'_'],
            $literal,
        );
    }
}
