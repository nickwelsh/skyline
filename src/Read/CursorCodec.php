<?php

namespace NickWelsh\Skyline\Read;

use JsonException;

final class CursorCodec
{
    /** @param array<string, mixed> $data */
    public function encode(string $type, array $data): string
    {
        $json = json_encode(['v' => 1, 'type' => $type, ...$data], JSON_THROW_ON_ERROR);

        return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    }

    /** @return array<string, mixed> */
    public function decode(string $cursor, string $type): array
    {
        $padding = (4 - strlen($cursor) % 4) % 4;
        $json = base64_decode(strtr($cursor.str_repeat('=', $padding), '-_', '+/'), true);

        if ($json === false) {
            throw new InvalidQuery('The cursor is invalid.');
        }

        try {
            $value = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidQuery('The cursor is invalid.');
        }

        if (! is_array($value) || ($value['v'] ?? null) !== 1 || ($value['type'] ?? null) !== $type) {
            throw new InvalidQuery('The cursor is invalid.');
        }

        return $value;
    }
}
