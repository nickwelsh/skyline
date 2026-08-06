<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Log\Events\MessageLogged;
use NickWelsh\Skyline\Persistence\PersistenceGuard;
use NickWelsh\Skyline\Support\LogEventSanitizer;
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
        private readonly LogEventSanitizer $logs,
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
            || ! $active->reserveBreadcrumb((int) $this->config->get('skyline.logging.max_breadcrumbs', 100))
        ) {
            return;
        }

        $this->handling = true;

        try {
            $presented = $this->logs->present([
                'log.level' => strtolower((string) $event->level),
                'log.channel' => (string) ($this->config->get('skyline.logging.channel') ?: $this->config->get('logging.default', 'default')),
                'log.message' => $event->message,
                'log.context' => $event->context,
            ]);
            $attributes = $presented['attributes'];
            $attributes['log.level'] = strtolower((string) $event->level);
            $attributes['log.context'] = json_encode($presented['context'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{}';
            $attributes['skyline.log.capture'] = json_encode($presented['capture'], JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);

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
}
