<?php

namespace NickWelsh\Skyline\Telemetry;

use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Http\Client\Factory;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use Psr\Http\Message\MessageInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Log\LoggerInterface;
use Throwable;

final class OutgoingHttpInstrumentation
{
    private const OPTION = 'skyline.instrumented';

    private bool $booted = false;

    public function __construct(
        private readonly Repository $config,
        private readonly Factory $http,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
        private readonly LoggerInterface $logger,
    ) {}

    public function boot(): void
    {
        if ($this->booted || ! $this->enabled()) {
            return;
        }

        $this->booted = true;
        $this->http->globalMiddleware($this->forClient('laravel'));
    }

    /** @return callable(callable): callable */
    public function forClient(string $client): callable
    {
        return function (callable $handler) use ($client): callable {
            $next = $this($handler);

            return fn (RequestInterface $request, array $options): PromiseInterface => $next(
                $request,
                [...$options, 'skyline.http.client' => $client],
            );
        };
    }

    /** Guzzle middleware usable by direct clients and Saloon's Guzzle sender. */
    public function __invoke(callable $handler): callable
    {
        return function (RequestInterface $request, array $options) use ($handler): PromiseInterface {
            $active = $this->attempts->current();

            if (! $this->enabled() || $active === null || ($options[self::OPTION] ?? false) === true) {
                return $handler($request, $options);
            }

            try {
                $span = $this->start($request, $active, $options);
            } catch (Throwable $exception) {
                $this->report($exception);

                return $handler($request, $options);
            }

            $options[self::OPTION] = true;

            try {
                $promise = $handler($request, $options);
            } catch (Throwable $exception) {
                $this->failed($span, $exception);

                throw $exception;
            }

            try {
                return $promise->then(
                    function (ResponseInterface $response) use ($span): ResponseInterface {
                        $this->completed($span, $response);

                        return $response;
                    },
                    function (mixed $reason) use ($span): PromiseInterface {
                        $this->failed($span, $reason);

                        return Create::rejectionFor($reason);
                    },
                );
            } catch (Throwable $exception) {
                $this->report($exception);

                return $promise;
            }
        };
    }

    /** @param array<string, mixed> $options */
    private function start(RequestInterface $request, ActiveAttempt $active, array $options): SpanInterface
    {
        $method = strtoupper($request->getMethod());
        $uri = $request->getUri();
        $attributes = [
            'skyline.role' => 'http',
            'skyline.run_id' => $active->runId,
            'skyline.attempt' => $active->number,
            'skyline.http.client' => is_string($options['skyline.http.client'] ?? null)
                ? $options['skyline.http.client']
                : 'guzzle',
            'http.request.method' => $method,
            'url.full' => $this->url($request),
            'server.address' => $uri->getHost(),
        ];

        if ($uri->getPort() !== null) {
            $attributes['server.port'] = $uri->getPort();
        }

        if ((bool) $this->config->get('skyline.http.capture_request_headers', false)) {
            $attributes['skyline.http.request.headers'] = $this->headers($request);
        }

        if ((bool) $this->config->get('skyline.http.capture_request_body', false)) {
            $body = $this->body($request->getBody(), $request->getHeaderLine('Content-Type'));

            if ($body !== null) {
                $attributes['skyline.http.request.body'] = $body;
            }
        }

        if ((bool) $this->config->get('skyline.http.capture_source', false)) {
            $attributes = [...$attributes, ...$this->source->attributes('skyline.http.source')];
        }

        return $this->tracer->get()->spanBuilder('HTTP '.$method)
            ->setParent($active->context)
            ->setSpanKind(SpanKind::KIND_CLIENT)
            ->setAttributes($attributes)
            ->startSpan();
    }

    private function completed(SpanInterface $span, ResponseInterface $response): void
    {
        try {
            $status = $response->getStatusCode();
            $span->setAttribute('http.response.status_code', $status);
            $this->captureResponse($span, $response);
            $span->setStatus($status >= 400 ? StatusCode::STATUS_ERROR : StatusCode::STATUS_OK);
            $span->end();
        } catch (Throwable $exception) {
            $this->report($exception);
            $this->end($span);
        }
    }

    private function failed(SpanInterface $span, mixed $reason): void
    {
        try {
            $exception = $reason instanceof Throwable ? $reason : Create::exceptionFor($reason);
            $span->setAttribute('error.type', $exception::class);

            if ($exception instanceof RequestException && $exception->getResponse() !== null) {
                $response = $exception->getResponse();
                $span->setAttribute('http.response.status_code', $response->getStatusCode());
                $this->captureResponse($span, $response);
            }

            $span->setStatus(StatusCode::STATUS_ERROR, 'HTTP request failed');
            $span->end();
        } catch (Throwable $exception) {
            $this->report($exception);
            $this->end($span);
        }
    }

    private function captureResponse(SpanInterface $span, ResponseInterface $response): void
    {
        if ((bool) $this->config->get('skyline.http.capture_response_headers', false)) {
            $span->setAttribute('skyline.http.response.headers', $this->headers($response));
        }

        if ((bool) $this->config->get('skyline.http.capture_response_body', false)) {
            $body = $this->body($response->getBody(), $response->getHeaderLine('Content-Type'));

            if ($body !== null) {
                $span->setAttribute('skyline.http.response.body', $body);
            }
        }
    }

    private function url(RequestInterface $request): string
    {
        $uri = $request->getUri()->withUserInfo('')->withFragment('');

        if (! (bool) $this->config->get('skyline.http.capture_query', false) && $uri->getQuery() !== '') {
            $query = collect(explode('&', $uri->getQuery()))
                ->map(function (string $parameter): string {
                    $key = explode('=', $parameter, 2)[0];

                    return $key === '' ? '' : $key.'=%5BREDACTED%5D';
                })
                ->filter()
                ->implode('&');
            $uri = $uri->withQuery($query);
        }

        return mb_strcut(
            (string) $uri,
            0,
            max(256, (int) $this->config->get('skyline.http.max_url_bytes', 8_192)),
            'UTF-8',
        );
    }

    private function headers(MessageInterface $message): string
    {
        $items = [];
        $truncated = false;
        $limit = max(256, (int) $this->config->get('skyline.http.max_header_bytes', 16_384));

        foreach ($message->getHeaders() as $name => $values) {
            if ($this->sensitiveHeader($name)) {
                $items[$name] = ['[REDACTED]'];
            } elseif ($this->allowedHeader($name)) {
                $items[$name] = array_values($values);
            } else {
                continue;
            }
            $preview = json_encode(['items' => $items, 'truncated' => false], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if (! is_string($preview) || strlen($preview) > $limit) {
                unset($items[$name]);
                $truncated = true;
                break;
            }
        }

        return $this->json(['items' => $items, 'truncated' => $truncated]);
    }

    private function body(StreamInterface $stream, string $contentType): ?string
    {
        if (! $stream->isSeekable() || ! $this->capturableContentType($contentType)) {
            return null;
        }

        try {
            $position = $stream->tell();
            $stream->rewind();
            $limit = max(256, (int) $this->config->get('skyline.http.max_body_bytes', 65_536));
            $value = $stream->read($limit + 1);
            $stream->seek($position);
        } catch (Throwable) {
            return null;
        }

        $originalBytes = $stream->getSize();
        $truncated = strlen($value) > $limit || ($originalBytes !== null && $originalBytes > $limit);
        $value = substr($value, 0, $limit);

        if (preg_match('//u', $value) !== 1) {
            return null;
        }

        $value = $this->redactBody($value, $contentType);

        return $this->json([
            'value' => $value,
            'contentType' => $contentType !== '' ? $contentType : null,
            'originalBytes' => $originalBytes ?? strlen($value),
            'truncated' => $truncated,
        ]);
    }

    private function sensitiveHeader(string $name): bool
    {
        $name = strtolower($name);

        return collect((array) $this->config->get('skyline.http.redact_headers', []))
            ->contains(fn (mixed $header): bool => is_string($header) && strtolower($header) === $name);
    }

    private function allowedHeader(string $name): bool
    {
        $name = strtolower($name);

        return collect((array) $this->config->get('skyline.http.header_allowlist', []))
            ->contains(fn (mixed $header): bool => is_string($header) && strtolower($header) === $name);
    }

    private function capturableContentType(string $contentType): bool
    {
        $type = strtolower(strtok($contentType, ';') ?: '');

        return str_starts_with($type, 'text/')
            || str_contains($type, 'json')
            || str_contains($type, 'xml')
            || $type === 'application/x-www-form-urlencoded'
            || $type === 'application/graphql';
    }

    private function redactBody(string $value, string $contentType): string
    {
        if (! str_contains(strtolower($contentType), 'json')) {
            return $value;
        }

        try {
            $decoded = json_decode($value, true, flags: JSON_THROW_ON_ERROR);
            $redacted = $this->redactBodyValue($decoded);

            return json_encode($redacted, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return $value;
        }
    }

    private function redactBodyValue(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && collect((array) $this->config->get('skyline.http.redact_body_fields', []))
            ->contains(fn (mixed $field): bool => is_string($field) && str_contains(strtolower($key), strtolower($field)))) {
            return '[REDACTED]';
        }

        if (! is_array($value)) {
            return $value;
        }

        foreach ($value as $childKey => $child) {
            $value[$childKey] = $this->redactBodyValue($child, is_string($childKey) ? $childKey : null);
        }

        return $value;
    }

    /** @param array<string, mixed> $value */
    private function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{}';
    }

    private function enabled(): bool
    {
        return (bool) $this->config->get('skyline.http.enabled', true);
    }

    private function end(SpanInterface $span): void
    {
        try {
            $span->end();
        } catch (Throwable) {
            // Monitoring failures cannot alter request behavior.
        }
    }

    private function report(Throwable $exception): void
    {
        try {
            $this->logger->warning('Skyline HTTP telemetry failed.', ['exception' => $exception]);
        } catch (Throwable) {
            // Monitoring failures cannot alter request behavior.
        }
    }
}
