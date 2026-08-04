<?php

namespace NickWelsh\Skyline\Persistence;

final class PersistenceGuard
{
    private int $depth = 0;

    public function active(): bool
    {
        return $this->depth > 0;
    }

    public function run(callable $callback): mixed
    {
        $this->depth++;

        try {
            return $callback();
        } finally {
            $this->depth--;
        }
    }
}
