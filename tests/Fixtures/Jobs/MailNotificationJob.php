<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;
use Tests\Fixtures\Notifications\MailTestNotification;

final class MailNotificationJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Notification::route('mail', ['notify@example.test' => 'Named Recipient'])
            ->notify(new MailTestNotification);
    }
}
