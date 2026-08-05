<?php

namespace Tests\Fixtures\Jobs;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Request;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use NickWelsh\Skyline\Telemetry\OutgoingHttpInstrumentation;

final class FailingHttpJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public static bool $preserved = false;

    public function handle(): void
    {
        $request = new Request('GET', 'https://unavailable.example.test/private');
        $expected = new RequestException('transport-secret', $request);
        $stack = HandlerStack::create(new MockHandler([$expected]));
        $stack->push(app(OutgoingHttpInstrumentation::class), 'skyline');

        try {
            (new Client(['handler' => $stack]))->sendAsync($request)->wait();
        } catch (RequestException $caught) {
            self::$preserved = $caught === $expected;
        }
    }
}
