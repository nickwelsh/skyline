# Outgoing HTTP instrumentation

Research date: 2026-08-04. Scope: Laravel 12/13, Guzzle 7, Saloon 3, and optional OpenTelemetry Guzzle auto-instrumentation.

## Recommendation

Build one Skyline-owned `OutgoingHttpRecorder` and thin adapters for Laravel, Guzzle, and Saloon. The recorder should own span lifecycle, normalization, redaction, bounded previews, source discovery, and failure isolation. Adapters should only translate their library lifecycle into `start`, `finish`, and `fail` calls.

Ship these seams:

1. **Laravel HTTP client: automatic event listeners.** Listen to `RequestSending`, `ResponseReceived`, and `ConnectionFailed`. This is Laravel's documented observation API, requires no request mutation, covers the facade, pools, batches, fakes, retries, and connection failures, and is unchanged across Laravel 12 and 13. Laravel documents the event timing and payloads; both framework branches dispatch them from `PendingRequest` ([Laravel 12 source](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Http/Client/PendingRequest.php), [Laravel 13 source](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Http/Client/PendingRequest.php), [Laravel 13 events](https://laravel.com/docs/13.x/http-client#events)). Key in-flight state by the underlying PSR-7 request object, not URL, so concurrent identical requests remain distinct.
2. **Direct Guzzle: explicit Skyline middleware.** Expose a callable Guzzle middleware and a helper that pushes it onto a `HandlerStack`. Start before calling the next handler; finish from both promise fulfillment and rejection. This handles sync and async clients because Guzzle handlers always return promises. Guzzle only applies middleware attached to a client's handler stack; its documented API has no process-wide middleware registry ([Guzzle handlers and middleware](https://docs.guzzlephp.org/en/stable/handlers-and-middleware.html)). Therefore Skyline cannot automatically observe every arbitrary `new Client()` without an extension-level hook.
3. **Saloon 3: automatic global Saloon middleware when the class exists.** Register named callbacks once through `Config::globalMiddleware()->onRequest()`, `onResponse()`, and `onFatalException()`. Saloon merges this static pipeline into every `PendingRequest`; the core pipeline has distinct request, response, and fatal-error stages ([Saloon middleware docs](https://docs.saloon.dev/digging-deeper/middleware), [v3.15 `Config`](https://github.com/saloonphp/saloon/blob/v3.15.0/src/Config.php), [v3.15 `MiddlewarePipeline`](https://github.com/saloonphp/saloon/blob/v3.15.0/src/Helpers/MiddlewarePipeline.php), [v3.15 `PendingRequest`](https://github.com/saloonphp/saloon/blob/v3.15.0/src/Http/PendingRequest.php)). This is sender-independent and retains Saloon request/connector identity; key state by `PendingRequest` identity. Saloon warns its global pipeline is static, survives between tests, and can be cleared with `Config::clearGlobalMiddleware()` ([docs](https://docs.saloon.dev/digging-deeper/middleware#global-middleware)).

Do not make official OpenTelemetry Guzzle auto-instrumentation a Skyline dependency. It is useful host-level instrumentation, but it needs `ext-opentelemetry`, uses the global OTel SDK/provider, lacks Laravel/Saloon identity, and intentionally does not read bodies. Skyline already owns a separate provider/export path and needs richer, privacy-controlled inspector data.

## Framework findings

### Laravel 12 and 13

`Factory` exposes `globalMiddleware`, `globalRequestMiddleware`, and `globalResponseMiddleware` in both supported branches ([12.x `Factory`](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Http/Client/Factory.php), [13.x `Factory`](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Http/Client/Factory.php)). They apply only to requests created by that Laravel factory. They are suitable for mutation but less direct than the event API for observation.

Laravel's three events provide the complete terminal split Skyline needs:

| Event | Meaning | Available data |
| --- | --- | --- |
| `RequestSending` | immediately before the request is sent | Laravel request, including underlying PSR-7 request |
| `ResponseReceived` | a response was received | same request plus response |
| `ConnectionFailed` | no response was received | request plus connection exception |

Laravel documents these exact guarantees ([12.x docs](https://laravel.com/docs/12.x/http-client#events), [13.x docs](https://laravel.com/docs/13.x/http-client#events)). Source inspection shows `RequestSending` is dispatched from the before-send handler and response/failure events are dispatched on both synchronous and asynchronous paths ([12.x `PendingRequest`](https://github.com/laravel/framework/blob/12.x/src/Illuminate/Http/Client/PendingRequest.php), [13.x `PendingRequest`](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Http/Client/PendingRequest.php)). Each retry invokes the send path again, so model attempts as separate HTTP child spans rather than overwriting the first request.

### Guzzle 7

A Guzzle middleware receives a PSR-7 request plus options, delegates to the next handler, and receives a promise fulfilled with a PSR-7 response or rejected with an exception. `HandlerStack::create()` preserves Guzzle's default request-option middleware; Skyline should push onto that stack instead of replacing it ([Guzzle middleware contract and stack](https://docs.guzzlephp.org/en/stable/handlers-and-middleware.html)).

The limitation is structural: middleware belongs to each `HandlerStack`, and each client selects its own handler. There is no documented global `Client` middleware hook. The supported no-extension integration must therefore be explicit, for example:

```php
$stack = GuzzleHttp\HandlerStack::create();
$stack->push(app(SkylineGuzzleMiddleware::class), 'skyline');

$client = new GuzzleHttp\Client(['handler' => $stack]);
```

Skyline may also publish a configured `ClientInterface` binding, but decorating the container binding is not complete coverage: manually constructed clients and third-party clients can bypass it, while replacing an application's existing client can discard its handler/options. Treat it as convenience, not the primary promise.

### Saloon 3

Saloon is sender-agnostic even though `GuzzleSender` is the default. Its documented middleware runs global, mock, plugin, user, then debugger stages; global middleware is the only core seam that covers all connectors and solo requests without requiring application changes ([middleware order](https://docs.saloon.dev/digging-deeper/middleware#middleware-execution-order), [PSR support](https://docs.saloon.dev/digging-deeper/psr-support)).

Use all three v3 pipeline hooks:

```php
$pipeline = Saloon\Config::globalMiddleware();
$pipeline->onRequest($start, 'skyline.http.start');
$pipeline->onResponse($finish, 'skyline.http.finish');
$pipeline->onFatalException($fail, 'skyline.http.fail');
```

`onFatalException` matters: the default `GuzzleSender` converts connect/no-response failures into Saloon `FatalRequestException`; normal HTTP error responses are still converted to Saloon responses before Saloon decides whether to throw ([v3.15 `GuzzleSender`](https://github.com/saloonphp/saloon/blob/v3.15.0/src/Http/Senders/GuzzleSender.php), [retry/failure behavior](https://docs.saloon.dev/digging-deeper/retrying-requests#exceptions)).

The Saloon adapter should own the logical Saloon span. If the underlying sender also uses Skyline's Guzzle middleware, set a namespaced Guzzle request option during Saloon request middleware and make the Guzzle adapter skip it. Otherwise the same network call appears twice. Apply the same single-owner rule to a Saloon Laravel sender: either the Saloon adapter owns the call or the Laravel adapter does, never both. Record `skyline.http.client = saloon`, connector class, and request class on the owning span.

## Optional OpenTelemetry Guzzle auto-instrumentation

PHP zero-code instrumentation requires PHP 8+, `ext-opentelemetry`, Composer autoloading, the OTel SDK, at least one instrumentation package, and configuration. The extension alone emits nothing ([official PHP requirements](https://opentelemetry.io/docs/zero-code/php/#requirements)). The Guzzle package further requires PHP `^8.1`, Guzzle `^7`, the extension, OTel API, and semantic conventions ([package metadata](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/main/src/Instrumentation/Guzzle/composer.json)).

The package Composer-registers an extension hook on `GuzzleHttp\Client::transfer`; it creates sync and async client spans and injects `traceparent`. It captures method, full URL, host/port/path, protocol, User-Agent, declared body sizes, status, exceptions, and explicitly allowlisted headers. It does **not** capture request or response bodies ([instrumentation source](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/main/src/Instrumentation/Guzzle/src/GuzzleInstrumentation.php), [README](https://github.com/open-telemetry/opentelemetry-php-contrib/tree/main/src/Instrumentation/Guzzle)). It can be disabled with `OTEL_PHP_DISABLED_INSTRUMENTATIONS=guzzle`; registration refuses to run without the extension ([registration source](https://github.com/open-telemetry/opentelemetry-php-contrib/blob/main/src/Instrumentation/Guzzle/_register.php)).

It gives broad Guzzle 7 coverage, including wrappers only when their runtime reaches `Client::transfer`. It cannot observe Guzzle 6 or non-Guzzle Saloon senders, and its low-level span cannot identify a Laravel facade call, Saloon connector, or Saloon request. Extension hooks must also register before the first observed call ([extension caveats](https://github.com/open-telemetry/opentelemetry-php-instrumentation#caveats)). It is therefore an optional coexistence case, not Skyline's integration seam. Document possible duplicate HTTP spans when a host enables it alongside Skyline adapters.

## Span and inspector shape

Create one `CLIENT` span for each physical send attempt, parented explicitly to the active Skyline Attempt. Follow stable OTel HTTP names where they fit:

- `http.request.method`
- `server.address`, optional `server.port`
- sanitized `url.full`
- `network.protocol.version`
- `http.response.status_code`
- request/response body sizes when known without reading streams
- `error.type` and recorded exception for connection/transport failure
- `skyline.role = http`
- `skyline.http.client = laravel|guzzle|saloon`
- Saloon connector/request classes when available
- Skyline source file/line, using the existing source-capture/editor-link module

The OTel HTTP convention recommends a client span per physical send, separate resend counts for retries/redirects, error status for transport failures, and status attributes for responses ([HTTP client spans](https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-client-span)). Skyline should expose retries as separate timeline rows when the library seam exposes each send. A Saloon logical retry wrapper may instead expose attempts as children if Saloon middleware runs once around its retry loop; test the actual v3 lifecycle before promising per-attempt rows.

## Privacy and capture defaults

Default capture must remain useful without persisting secrets:

| Data | Default | Optional behavior |
| --- | --- | --- |
| method, scheme, host, port, path, status, duration | on | always bounded metadata |
| query parameter names | on | retain keys, replace every value with `[REDACTED]` |
| query values and URL credentials | off | credentials never stored; named denylist still redacted |
| request/response headers | off | explicit allowlist only; never store `Authorization`, `Proxy-Authorization`, `Cookie`, or `Set-Cookie` |
| request body preview | off | independent opt-in; text/JSON/form only; redact configured keys; byte cap |
| response body preview | off | independent opt-in; text/JSON only; redact configured keys; byte cap |
| multipart, binary, compressed, file, or non-seekable stream contents | off | store media type and known size only |
| source file/line | off | reuse `SKYLINE_HTTP_CAPTURE_SOURCE`; no arguments/full stack |

OTel requires URL credentials to be removed, recommends scrubbing sensitive URL content, and requires explicit header allowlists because capturing all headers is a security risk ([URL attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/url/), [HTTP header guidance](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)). Skyline should be stricter: redact every query value by default, not only known signature keys.

Never cast an arbitrary PSR stream to string merely to inspect it. Read a preview only when the stream is seekable, preserve its cursor, stop at the configured byte limit, and fail closed on any read error. Never consume streaming responses, upload streams, sinks, multipart bodies, or file downloads. Suggested independent defaults:

```dotenv
SKYLINE_HTTP_CAPTURE_REQUEST_HEADERS=false
SKYLINE_HTTP_CAPTURE_RESPONSE_HEADERS=false
SKYLINE_HTTP_CAPTURE_REQUEST_BODY=false
SKYLINE_HTTP_CAPTURE_RESPONSE_BODY=false
SKYLINE_HTTP_CAPTURE_SOURCE=false
SKYLINE_HTTP_MAX_BODY_BYTES=65536
```

Allowlist header names and redaction keys belong in published config arrays, not comma-packed environment values. Keep all adapters fail-open for the application and fail-closed for telemetry: instrumentation errors must never mutate requests, responses, promise resolution, or exception propagation.

## Delivery order

1. Core recorder, sanitizer, body-preview helper, and read DTO/UI.
2. Laravel event adapter with sync, retry, pool/batch, fake, 4xx/5xx, and connection-failure tests.
3. Saloon 3 optional adapter with response, fatal, async, mock, retry, and static-reset tests.
4. Explicit Guzzle middleware with sync/async success/failure and custom-stack tests.
5. Coexistence tests proving one Skyline row when Saloon uses Skyline Guzzle middleware, and documenting behavior with official OTel Guzzle auto-instrumentation.
