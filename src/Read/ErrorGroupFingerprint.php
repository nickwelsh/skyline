<?php

namespace NickWelsh\Skyline\Read;

final class ErrorGroupFingerprint
{
    /** @param array<string, mixed> $exception @return array{id: string, fingerprint: string} */
    public function identify(string $jobType, array $exception): array
    {
        $application = collect($exception['frames'] ?? [])->first(
            fn (mixed $frame): bool => is_array($frame) && ($frame['isVendor'] ?? true) === false,
        );
        $location = is_array($application) ? $application : ($exception['location'] ?? null);
        $file = is_array($location) && is_string($location['file'] ?? null) ? $location['file'] : '';
        $callable = is_array($application) ? $this->callable($application) : '';
        $fingerprint = hash('sha256', implode("\0", [$jobType, (string) ($exception['class'] ?? ''), $file, $callable]));

        return ['id' => 'error_'.$fingerprint, 'fingerprint' => $fingerprint];
    }

    /** @param array<string, mixed> $frame */
    private function callable(array $frame): string
    {
        return (string) ($frame['class'] ?? '').(string) ($frame['type'] ?? '').(string) ($frame['function'] ?? '');
    }
}
