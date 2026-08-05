<?php

namespace NickWelsh\Skyline\Telemetry;

use GuzzleHttp\Promise\Create;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Contracts\Config\Repository;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Context\ContextInterface;
use Throwable;

final class CustomTelemetry
{
    /** @var list<array{span: SpanInterface, context: ContextInterface}> */
    private array $stack = [];

    public function __construct(
        private readonly Repository $config,
        private readonly AttemptRegistry $attempts,
        private readonly SkylineTracer $tracer,
        private readonly SourceLocator $source,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function measure(string $name, callable $callback, array $attributes = []): mixed
    {
        $active = $this->attempts->current();

        if ($active === null || ! (bool) $this->config->get('skyline.custom.enabled', true)) {
            return $callback();
        }

        $parent = $this->stack === [] ? $active->context : $this->stack[array_key_last($this->stack)]['context'];
        $span = $this->tracer->get()->spanBuilder($this->name($name))
            ->setParent($parent)
            ->setAttributes([
                'skyline.role' => 'custom',
                'skyline.run_id' => $active->runId,
                'skyline.attempt' => $active->number,
                ...$this->attributes($attributes),
                ...$this->source->attributes('skyline.custom.source'),
            ])
            ->startSpan();
        $this->stack[] = ['span' => $span, 'context' => $span->storeInContext($parent)];

        try {
            $value = $callback();
        } catch (Throwable $exception) {
            $this->fail($span, $exception);

            throw $exception;
        } finally {
            array_pop($this->stack);
        }

        if ($value instanceof PromiseInterface) {
            return $value->then(
                function (mixed $result) use ($span): mixed {
                    $this->complete($span);

                    return $result;
                },
                function (mixed $reason) use ($span): PromiseInterface {
                    $this->fail($span, $reason);

                    return Create::rejectionFor($reason);
                },
            );
        }

        $this->complete($span);

        return $value;
    }

    /** @param array<string, mixed> $attributes */
    public function event(string $name, array $attributes = []): void
    {
        $active = $this->attempts->current();

        if ($active === null || ! (bool) $this->config->get('skyline.custom.enabled', true)) {
            return;
        }

        $span = $this->stack === [] ? $active->span : $this->stack[array_key_last($this->stack)]['span'];
        $span->addEvent($this->name($name), $this->attributes($attributes));
    }

    /** @param array<string, mixed> $attributes @return array<string, bool|float|int|string> */
    private function attributes(array $attributes): array
    {
        $result = [];
        $limit = max(1, (int) $this->config->get('skyline.custom.max_attributes', 32));
        $stringLimit = max(16, (int) $this->config->get('skyline.custom.max_attribute_bytes', 1_024));

        foreach ($attributes as $key => $value) {
            if (count($result) >= $limit || ! is_string($key) || $key === '') {
                break;
            }

            $key = mb_strcut($key, 0, 128, 'UTF-8');
            $result[$key] = match (true) {
                is_bool($value), is_int($value), is_float($value) => $value,
                is_string($value) => mb_strcut($value, 0, $stringLimit, 'UTF-8'),
                is_array($value) => '[array:'.count($value).']',
                is_object($value) => '[object]',
                is_resource($value) => '[resource]',
                default => '[null]',
            };
        }

        return $result;
    }

    private function name(string $name): string
    {
        $name = trim($name);

        return mb_strcut($name !== '' ? $name : 'Custom span', 0, 256, 'UTF-8');
    }

    private function complete(SpanInterface $span): void
    {
        $span->setStatus(StatusCode::STATUS_OK);
        $span->end();
    }

    private function fail(SpanInterface $span, mixed $reason): void
    {
        $span->setAttribute('error.type', $reason instanceof Throwable ? $reason::class : get_debug_type($reason));
        $span->setStatus(StatusCode::STATUS_ERROR, 'Custom span failed');
        $span->end();
    }
}
