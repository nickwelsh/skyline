<?php

use NickWelsh\Skyline\Persistence\FailureReporter;
use Psr\Log\AbstractLogger;

it('rate limits persistence failure logs', function (): void {
    $logger = new class extends AbstractLogger
    {
        /** @var list<array{level: mixed, message: string|Stringable, context: array<string, mixed>}> */
        public array $records = [];

        public function log($level, string|Stringable $message, array $context = []): void
        {
            $this->records[] = compact('level', 'message', 'context');
        }
    };
    $reporter = new FailureReporter($logger, 60);

    $reporter->report(new RuntimeException('first'));
    $reporter->report(new RuntimeException('second'));

    expect($logger->records)->toHaveCount(1)
        ->and($logger->records[0]['message'])->toBe('Skyline persistence failed.')
        ->and($logger->records[0]['context']['suppressed_failures'])->toBe(0);
});
