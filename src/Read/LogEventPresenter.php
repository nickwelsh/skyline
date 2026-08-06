<?php

namespace NickWelsh\Skyline\Read;

use NickWelsh\Skyline\Support\TelemetryEventLevel;

final class LogEventPresenter
{
    /** @param array<string, mixed> $attributes @return array{level: string, message: string, context: array<string, bool|float|int|string>, channel: ?string, attributes: array<string, mixed>, capture: array{isTruncated: bool, truncated: list<array{path: string, originalBytes: int}>}} */
    public function present(array $attributes): array
    {
        $privacy = new PrivacySanitizer;
        $truncated = [];
        $message = $this->bounded(
            $privacy,
            is_string($attributes['log.message'] ?? null) ? $attributes['log.message'] : '',
            max(64, (int) config('skyline.logging.max_message_bytes', 1_024)),
            'message',
            $truncated,
        );
        $channel = is_string($attributes['log.channel'] ?? null)
            ? $this->bounded($privacy, $attributes['log.channel'], 512, 'channel', $truncated)
            : null;
        $decoded = is_string($attributes['log.context'] ?? null) ? json_decode($attributes['log.context'], true) : [];
        $decoded = is_array($decoded) ? $decoded : [];
        $context = [];

        foreach ($this->allowedContextKeys() as $key) {
            $value = $decoded[$key] ?? null;
            if (is_bool($value) || is_int($value) || is_float($value)) {
                $context[$key] = $value;
            } elseif (is_string($value)) {
                $context[$key] = $this->bounded($privacy, $value, max(64, (int) config('skyline.logging.max_message_bytes', 1_024)), 'context.'.$key, $truncated);
            }
        }

        $level = TelemetryEventLevel::normalize($attributes['log.level'] ?? null);
        $safeAttributes = ['log.level' => strtolower($level), 'log.message' => $message];
        if ($channel !== null) {
            $safeAttributes['log.channel'] = $channel;
        }
        if ($context !== []) {
            $safeAttributes['log.context'] = $context;
        }

        return [
            'level' => $level,
            'message' => $message,
            'context' => $context,
            'channel' => $channel,
            'attributes' => $safeAttributes,
            'capture' => ['isTruncated' => $truncated !== [], 'truncated' => $truncated],
        ];
    }

    /** @param list<array{path: string, originalBytes: int}> $truncated */
    private function bounded(PrivacySanitizer $privacy, string $value, int $limit, string $path, array &$truncated): string
    {
        $capture = $privacy->string($this->redact($value), $limit, $path);
        if ($capture['isTruncated']) {
            $truncated[] = ['path' => $path, 'originalBytes' => $capture['originalBytes']];
        }

        return $capture['value'];
    }

    private function redact(string $value): string
    {
        $value = preg_replace('/\b(password|passwd|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/i', '$1=[REDACTED]', $value) ?? '';

        return preg_replace('/\bBearer\s+[^\s,;]+/i', 'Bearer [REDACTED]', $value) ?? '';
    }

    /** @return list<string> */
    private function allowedContextKeys(): array
    {
        return array_values(array_unique(array_filter(
            (array) config('skyline.logging.context_allowlist', []),
            fn (mixed $key): bool => is_string($key) && $key !== '' && strlen($key) <= 512,
        )));
    }
}
