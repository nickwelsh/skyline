<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Log\Events\MessageLogged;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use Throwable;

final class LogBreadcrumbInstrumentation
{
    private bool $booted = false;

    private bool $handling = false;

    public function __construct(
        private readonly Dispatcher $events,
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly PersistenceGuard $persistenceGuard,
    ) {}

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $this->booted = true;
        $this->events->listen(MessageLogged::class, fn (MessageLogged $event) => $this->record($event));
    }

    private function record(MessageLogged $event): void
    {
        $active = $this->attempts->current();

        if ($active === null
            || $this->handling
            || $this->persistenceGuard->active()
            || ! (bool) $this->config->get('skyline.logging.enabled', false)
            || ! in_array(strtolower((string) $event->level), $this->levels(), true)
            || str_starts_with($event->message, 'Skyline ')
        ) {
            return;
        }

        $this->handling = true;

        try {
            $attributes = [
                'log.level' => strtolower((string) $event->level),
                'log.channel' => (string) $this->config->get('logging.default', 'default'),
                'log.message' => $this->message($event->message),
            ];
            $context = $this->context($event->context);

            if ($context !== []) {
                $attributes['log.context'] = json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{}';
            }

            $active->span->addEvent('log', $attributes);
        } catch (Throwable) {
            // Monitoring failures cannot alter host logging.
        } finally {
            $this->handling = false;
        }
    }

    /** @return list<string> */
    private function levels(): array
    {
        return array_values(array_filter(array_map(
            fn (mixed $level): ?string => is_string($level) ? strtolower($level) : null,
            (array) $this->config->get('skyline.logging.levels', []),
        )));
    }

    private function message(string $message): string
    {
        $message = preg_replace(
            '/\b(password|passwd|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/i',
            '$1=[REDACTED]',
            $message,
        ) ?? '';
        $message = preg_replace('/\bBearer\s+[^\s,;]+/i', 'Bearer [REDACTED]', $message) ?? '';

        return mb_strcut($message, 0, max(64, (int) $this->config->get('skyline.logging.max_message_bytes', 1_024)), 'UTF-8');
    }

    /** @param array<string, mixed> $context @return array<string, bool|float|int|string> */
    private function context(array $context): array
    {
        $allowed = array_values(array_filter(
            (array) $this->config->get('skyline.logging.context_allowlist', []),
            fn (mixed $key): bool => is_string($key),
        ));
        $result = [];

        foreach ($allowed as $key) {
            $value = $context[$key] ?? null;

            if (is_bool($value) || is_int($value) || is_float($value)) {
                $result[$key] = $value;
            } elseif (is_string($value)) {
                $result[$key] = $this->message($value);
            }
        }

        return $result;
    }
}
