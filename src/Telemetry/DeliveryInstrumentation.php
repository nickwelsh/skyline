<?php

namespace NickWelsh\Skyline\Telemetry;

use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Notifications\Events\NotificationFailed;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Notifications\Events\NotificationSent;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use Psr\Log\LoggerInterface;
use Throwable;

final class DeliveryInstrumentation
{
    private bool $booted = false;

    /** @var array<string, array{span: SpanInterface, run_id: string, attempt: int}> */
    private array $pending = [];

    public function __construct(
        private readonly Dispatcher $events,
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
        private readonly LoggerInterface $logger,
    ) {}

    public function boot(): void
    {
        if ($this->booted || ! (bool) $this->config->get('skyline.delivery.enabled', true)) {
            return;
        }

        $this->booted = true;
        $this->listen(MessageSending::class, fn (MessageSending $event) => $this->mailSending($event));
        $this->listen(MessageSent::class, fn (MessageSent $event) => $this->complete($this->mailKey($event->message), true, 'sent'));
        $this->listen(NotificationSending::class, fn (NotificationSending $event) => $this->notificationSending($event));
        $this->listen(NotificationSent::class, fn (NotificationSent $event) => $this->complete($this->notificationKey($event->notification, $event->channel), true, 'sent'));
        $this->listen(NotificationFailed::class, fn (NotificationFailed $event) => $this->complete($this->notificationKey($event->notification, $event->channel), false, 'failed'));
    }

    public function finishAttempt(ActiveAttempt $attempt): void
    {
        foreach ($this->pending as $key => $pending) {
            if ($pending['run_id'] === $attempt->runId && $pending['attempt'] === $attempt->number) {
                $this->complete($key, false, 'incomplete');
            }
        }
    }

    private function mailSending(MessageSending $event): void
    {
        $active = $this->attempts->current();

        if ($active === null) {
            return;
        }

        $type = $event->data['__laravel_mailable'] ?? 'mail';
        $mailer = $event->data['mailer'] ?? 'default';
        $recipients = count($event->message->getTo())
            + count($event->message->getCc())
            + count($event->message->getBcc());
        $attributes = [
            'skyline.role' => 'mail',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'messaging.system' => 'email',
            'messaging.message.type' => is_string($type) ? $type : 'mail',
            'messaging.destination.name' => is_string($mailer) ? $mailer : 'default',
            'messaging.destination.recipient_count' => $recipients,
        ];

        if ((bool) $this->config->get('skyline.delivery.capture_source', false)) {
            $attributes = [...$attributes, ...$this->source->attributes('skyline.mail.source')];
        }

        $this->pending[$this->mailKey($event->message)] = [
            'span' => $this->tracer->get()->spanBuilder('Mail '.class_basename($attributes['messaging.message.type']))
                ->setParent($active->context)
                ->setSpanKind(SpanKind::KIND_PRODUCER)
                ->setAttributes($attributes)
                ->startSpan(),
            'run_id' => $active->runId,
            'attempt' => $active->number,
        ];
    }

    private function notificationSending(NotificationSending $event): void
    {
        $active = $this->attempts->current();

        if ($active === null) {
            return;
        }

        $attributes = [
            'skyline.role' => 'notification',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'messaging.system' => 'laravel-notification',
            'messaging.message.type' => $event->notification::class,
            'messaging.destination.name' => $event->channel,
            'messaging.destination.recipient_count' => 1,
        ];

        if ((bool) $this->config->get('skyline.delivery.capture_source', false)) {
            $attributes = [...$attributes, ...$this->source->attributes('skyline.notification.source')];
        }

        $this->pending[$this->notificationKey($event->notification, $event->channel)] = [
            'span' => $this->tracer->get()->spanBuilder('Notification '.$event->channel)
                ->setParent($active->context)
                ->setSpanKind(SpanKind::KIND_PRODUCER)
                ->setAttributes($attributes)
                ->startSpan(),
            'run_id' => $active->runId,
            'attempt' => $active->number,
        ];
    }

    private function complete(string $key, bool $success, string $outcome): void
    {
        $pending = $this->pending[$key] ?? null;

        if ($pending === null) {
            return;
        }

        unset($this->pending[$key]);
        $pending['span']->setAttribute('messaging.operation.outcome', $outcome);
        $pending['span']->setStatus($success ? StatusCode::STATUS_OK : StatusCode::STATUS_ERROR);
        $pending['span']->end();
    }

    private function mailKey(object $message): string
    {
        return 'mail:'.spl_object_id($message);
    }

    private function notificationKey(object $notification, string $channel): string
    {
        return 'notification:'.spl_object_id($notification).':'.$channel;
    }

    private function listen(string $event, callable $listener): void
    {
        $this->events->listen($event, function (object $value) use ($listener): void {
            try {
                $listener($value);
            } catch (Throwable $exception) {
                try {
                    $this->logger->warning('Skyline delivery telemetry failed.', ['exception' => $exception]);
                } catch (Throwable) {
                    // Monitoring failures cannot alter delivery behavior.
                }
            }
        });
    }
}
