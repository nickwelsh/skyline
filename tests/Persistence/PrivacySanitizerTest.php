<?php

use NickWelsh\Skyline\Support\PrivacySanitizer;

it('allows only explicit non-sensitive cache attributes', function (): void {
    $attributes = (new PrivacySanitizer)->attributes([
        'cache.operation' => 'PUT',
        'cache.store' => 'redis',
        'cache.key_captured' => true,
        'cache.ttl' => 60,
        'cache.forever' => false,
        'cache.strategy' => 'remember',
        'cache.fresh_ttl' => 30,
        'cache.key_count' => 2,
        'cache.outcome' => 'stored',
        'cache.hit' => true,
        'cache.key' => 'raw-private-key',
        'cache.value' => 'raw-private-value',
        'cache.future_private' => 'must-not-pass',
    ]);

    expect($attributes)->toBe([
        'cache.operation' => 'PUT',
        'cache.store' => 'redis',
        'cache.key_captured' => true,
        'cache.ttl' => 60,
        'cache.forever' => false,
        'cache.strategy' => 'remember',
        'cache.fresh_ttl' => 30,
        'cache.key_count' => 2,
        'cache.outcome' => 'stored',
        'cache.hit' => true,
    ]);
});
