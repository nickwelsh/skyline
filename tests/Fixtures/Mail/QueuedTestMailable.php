<?php

namespace Tests\Fixtures\Mail;

use Illuminate\Contracts\Queue\ShouldQueue;

final class QueuedTestMailable extends TestMailable implements ShouldQueue {}
