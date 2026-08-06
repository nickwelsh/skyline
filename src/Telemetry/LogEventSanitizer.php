<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use NickWelsh\Skyline\Read\PrivacySanitizer;
use NickWelsh\Skyline\Support\TelemetryEventLevel;

final readonly class LogEventSanitizer
{
    public function __construct(private Repository $config) {}

    /** @param array<string, mixed> $attributes @return array{level: string, message: string, context: array<string, bool|float|int|string>, channel: ?string, attributes: array<string, mixed>, capture: array{isTruncated: bool, truncated: list<array{path: string, originalBytes: int}>}} */
    public function present(array $attributes): array
    {
        $privacy = new PrivacySanitizer;
        $truncated = [];
        $message = $this->bounded($privacy, is_string($attributes['log.message'] ?? null) ? $attributes['log.message'] : '', 'message', $truncated);
        $channel = is_string($attributes['log.channel'] ?? null)
            ? $this->bounded($privacy, $attributes['log.channel'], 'channel', $truncated, 512)
            : null;
        $decoded = is_string($attributes['log.context'] ?? null) ? json_decode($attributes['log.context'], true) : ($attributes['log.context'] ?? []);
        $decoded = is_array($decoded) ? $decoded : [];
        $context = [];

        foreach ($this->allowedContextKeys() as $key) {
            $value = $decoded[$key] ?? null;
            if (is_bool($value) || is_int($value) || is_float($value)) {
                $context[$key] = $value;
            } elseif (is_string($value)) {
                $context[$key] = $this->bounded($privacy, $value, 'context.'.$key, $truncated);
            }
        }

        $recorded = is_string($attributes['skyline.log.capture'] ?? null) ? json_decode($attributes['skyline.log.capture'], true) : [];
        foreach (is_array($recorded['truncated'] ?? null) ? $recorded['truncated'] : [] as $item) {
            if (is_array($item) && is_string($item['path'] ?? null) && is_int($item['originalBytes'] ?? null)) {
                $truncated[] = ['path' => $item['path'], 'originalBytes' => $item['originalBytes']];
            }
        }
        $truncated = array_values(array_unique($truncated, SORT_REGULAR));
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
    private function bounded(PrivacySanitizer $privacy, string $value, string $path, array &$truncated, ?int $limit = null): string
    {
        $capture = $privacy->string($this->redact($value), $limit ?? max(64, (int) $this->config->get('skyline.logging.max_message_bytes', 1_024)), $path);
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
            (array) $this->config->get('skyline.logging.context_allowlist', []),
            fn (mixed $key): bool => is_string($key) && $key !== '' && strlen($key) <= 512,
        )));
    }
}
