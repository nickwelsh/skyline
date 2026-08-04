<?php

namespace NickWelsh\Skyline\Http;

use Illuminate\Http\JsonResponse;
use NickWelsh\Skyline\Read\InvalidQuery;
use NickWelsh\Skyline\Read\RecordNotFound;
use NickWelsh\Skyline\Read\TraceChanged;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final readonly class ApiResponder
{
    public function __construct(private LoggerInterface $logger) {}

    public function execute(callable $callback): Response
    {
        try {
            $response = $callback();
        } catch (InvalidQuery $exception) {
            $response = $this->error('invalid_query', $exception->getMessage(), 422);
        } catch (RecordNotFound) {
            $response = $this->error('not_found', 'The requested Skyline record was not found.', 404);
        } catch (TraceChanged) {
            $response = $this->error('trace_changed', 'The Trace changed while it was being read. Retry the request.', 409);
        } catch (Throwable $exception) {
            $correlationId = bin2hex(random_bytes(8));

            try {
                $this->logger->error('Skyline read failed.', [
                    'exception' => $exception,
                    'correlation_id' => $correlationId,
                ]);
            } catch (Throwable) {
                // Monitoring failures cannot alter the response.
            }

            $response = $this->error(
                'read_failed',
                'Skyline could not read telemetry.',
                500,
                $correlationId,
            );
        }

        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    private function error(string $code, string $message, int $status, ?string $correlationId = null): JsonResponse
    {
        return response()->json([
            'error' => array_filter([
                'code' => $code,
                'message' => $message,
                'correlationId' => $correlationId,
            ], fn (mixed $value): bool => $value !== null),
        ], $status);
    }
}
