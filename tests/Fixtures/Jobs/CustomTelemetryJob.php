<?php

namespace Tests\Fixtures\Jobs;

use GuzzleHttp\Promise\Create;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use LogicException;
use NickWelsh\Skyline\Facades\Skyline;
use RuntimeException;

final class CustomTelemetryJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $value = Skyline::measure('Generate PDF', function (): int {
            Skyline::event('Rendered page', ['page' => 1, 'secret' => new \stdClass]);

            return Skyline::measure('Upload PDF', fn (): int => 42, ['bytes' => 512]);
        });

        if ($value !== 42) {
            throw new RuntimeException('Custom telemetry changed the return value.');
        }

        $async = Skyline::measure('Async export', fn () => Create::promiseFor('exported'))->wait();

        if ($async !== 'exported') {
            throw new RuntimeException('Custom telemetry changed the async result.');
        }

        $nestedAsync = Skyline::measure('Async parent', fn () => Create::promiseFor('ready'))
            ->then(fn (): int => Skyline::measure('Async child', fn (): int => 7))
            ->wait();

        if ($nestedAsync !== 7) {
            throw new RuntimeException('Custom telemetry changed the nested async result.');
        }

        $original = new LogicException('private failure');

        try {
            Skyline::measure('Fail safely', fn () => throw $original);
        } catch (LogicException $caught) {
            if ($caught !== $original) {
                throw new RuntimeException('Custom telemetry changed the exception.');
            }
        }
    }
}
