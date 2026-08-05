<?php

namespace Tests\Fixtures\Jobs;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use NickWelsh\Skyline\Telemetry\OutgoingHttpInstrumentation;

final class HttpJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        Http::withHeaders([
            'Authorization' => 'Bearer request-secret',
            'X-Visible' => 'laravel',
        ])->withBody('{"name":"Laravel","api_token":"body-secret"}', 'application/json')
            ->post('https://api.example.test/people?token=query-secret');

        $stack = HandlerStack::create(new MockHandler([
            new Response(202, ['Content-Type' => 'application/json', 'X-Visible' => 'guzzle'], '{"accepted":true}'),
        ]));
        $stack->push(app(OutgoingHttpInstrumentation::class)->forClient('guzzle'), 'skyline');

        (new Client(['handler' => $stack]))->put(
            'https://direct.example.test/jobs/42?signature=direct-secret',
            [
                'headers' => ['Content-Type' => 'application/json'],
                'body' => '{"mode":"direct"}',
            ],
        );
    }
}
