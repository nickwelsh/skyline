<?php

namespace Tests\Fixtures\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Tests\Fixtures\Mail\TestMailable;
use Throwable;

final class FailingDeliveryJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        try {
            Mail::to('failure@example.test')->send(new TestMailable);
        } catch (Throwable) {
            // The application intentionally handles the delivery failure.
        }
    }
}
