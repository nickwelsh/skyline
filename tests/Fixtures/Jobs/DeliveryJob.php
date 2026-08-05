<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Events\NotificationFailed;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use stdClass;
use Tests\Fixtures\Mail\QueuedTestMailable;
use Tests\Fixtures\Mail\TestMailable;
use Tests\Fixtures\Notifications\TestNotification;

final class DeliveryJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Mail::to(['first@example.test', 'second@example.test'])->send(new TestMailable);
        Mail::to('queued@example.test')->queue(new QueuedTestMailable);

        $notification = new TestNotification;
        $notifiable = new stdClass;
        Event::dispatch(new NotificationSending($notifiable, $notification, 'database'));
        Event::dispatch(new NotificationSent($notifiable, $notification, 'database'));
        Event::dispatch(new NotificationSending($notifiable, $notification, 'slack'));
        Event::dispatch(new NotificationFailed($notifiable, $notification, 'slack', ['route' => 'private-route']));
    }
}
