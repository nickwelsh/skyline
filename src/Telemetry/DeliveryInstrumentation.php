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
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
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
        private readonly ValueCapture $values,
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
        $this->listen(NotificationSent::class, fn (NotificationSent $event) => $this->complete($this->notificationKey($event->notification, $event->channel), true, 'sent', $event->response, true));
        $this->listen(NotificationFailed::class, fn (NotificationFailed $event) => $this->complete($this->notificationKey($event->notification, $event->channel), false, 'failed', $event->data, true));
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

        $type = $event->data['__laravel_mailable'] ?? $event->data['__laravel_notification'] ?? 'mail';
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

        if ($this->capture('capture_recipients')) {
            $attributes['messaging.destination.recipients'] = $this->recipients($event->message);
        }

        if ($this->capture('capture_content')) {
            $attributes = [...$attributes, ...$this->mailContent($event->message)];
        }

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

        if ($this->capture('capture_recipients')) {
            $attributes['messaging.destination.identity'] = $this->values->encode(
                $this->notifiableIdentity($event->notifiable),
                $this->contentBytes(),
            );
        }

        if ($this->capture('capture_content')) {
            $attributes['messaging.message.data'] = $this->values->encode($event->notification, $this->contentBytes());
        }

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

    private function complete(string $key, bool $success, string $outcome, mixed $data = null, bool $hasData = false): void
    {
        $pending = $this->pending[$key] ?? null;

        if ($pending === null) {
            return;
        }

        unset($this->pending[$key]);
        $pending['span']->setAttribute('messaging.operation.outcome', $outcome);

        if ($hasData && $this->capture('capture_content')) {
            $pending['span']->setAttribute('messaging.operation.data', $this->values->encode($data, $this->contentBytes()));
        }

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

    /** @return array<string, string|bool> */
    private function mailContent(Email $message): array
    {
        $attributes = [];
        $subject = $message->getSubject();

        if (is_string($subject)) {
            $attributes['messaging.message.subject'] = $this->text($subject);
            $attributes['messaging.message.subject_truncated'] = strlen($subject) > $this->contentBytes();
        }

        foreach (['text' => $message->getTextBody(), 'html' => $message->getHtmlBody()] as $kind => $body) {
            if (! is_string($body)) {
                continue;
            }

            $attributes['messaging.message.'.$kind] = $this->text($body);
            $attributes['messaging.message.'.$kind.'_truncated'] = strlen($body) > $this->contentBytes();
        }

        return $attributes;
    }

    private function recipients(Email $message): string
    {
        $recipients = [];

        foreach (['to' => $message->getTo(), 'cc' => $message->getCc(), 'bcc' => $message->getBcc()] as $kind => $addresses) {
            foreach ($addresses as $address) {
                if (! $address instanceof Address) {
                    continue;
                }

                $recipient = ['kind' => $kind, 'address' => $address->getAddress()];

                if ($address->getName() !== '') {
                    $recipient['name'] = $address->getName();
                }

                $recipients[] = $recipient;
            }
        }

        while (strlen($this->json($recipients)) > $this->contentBytes() && $recipients !== []) {
            array_pop($recipients);
        }

        return $this->json($recipients);
    }

    /** @return array<string, mixed> */
    private function notifiableIdentity(mixed $notifiable): array
    {
        if (! is_object($notifiable)) {
            return ['type' => get_debug_type($notifiable), 'value' => $notifiable];
        }

        $identity = ['type' => $notifiable::class];

        if (method_exists($notifiable, 'getKey')) {
            $identity['id'] = $notifiable->getKey();
        }

        return $identity;
    }

    private function text(string $value): string
    {
        return mb_strcut($value, 0, $this->contentBytes(), 'UTF-8');
    }

    private function contentBytes(): int
    {
        return max(256, (int) $this->config->get('skyline.delivery.max_content_bytes', 65_536));
    }

    private function capture(string $key): bool
    {
        return (bool) $this->config->get('skyline.delivery.'.$key, $this->config->get('skyline.capture_all', false));
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
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
