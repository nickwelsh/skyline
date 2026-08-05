<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Support\Collection;

final readonly class QueueTargetPaginator
{
    private const PAGE_SIZE = 25;

    public function __construct(private CursorCodec $cursors) {}

    /** @param Collection<int, Collection<int, object>> $groups @return array{Collection<int, Collection<int, object>>, ?string, ?string} */
    public function page(Collection $groups, mixed $cursor): array
    {
        $direction = 'next';
        if ($cursor !== null) {
            if (! is_string($cursor)) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $decoded = $this->cursors->decode($cursor, 'queue-targets');
            $direction = $decoded['direction'] ?? null;
            $boundary = QueueTargetIdentity::fromCursor($decoded);
            if (! in_array($direction, ['next', 'previous'], true) || $boundary === null) {
                throw new InvalidQuery('The cursor is invalid.');
            }
            $groups = $groups->filter(function (Collection $runs) use ($direction, $boundary): bool {
                $identity = QueueTargetIdentity::fromRow($runs->first());

                return $direction === 'next' ? $identity->compare($boundary) > 0 : $identity->compare($boundary) < 0;
            });
            if ($direction === 'previous') {
                $groups = $groups->reverse()->values();
            }
        }

        $page = $groups->take(self::PAGE_SIZE);
        if ($direction === 'previous') {
            $page = $page->reverse()->values();
        }
        $first = $page->first()?->first();
        $last = $page->last()?->first();
        $firstIdentity = $first === null ? null : QueueTargetIdentity::fromRow($first);
        $previous = $firstIdentity !== null && $groups->contains(fn (Collection $runs) => QueueTargetIdentity::fromRow($runs->first())->compare($firstIdentity) < 0)
            ? $this->cursor('previous', $firstIdentity)
            : ($cursor !== null && $direction === 'next' ? $this->cursor('previous', $firstIdentity) : null);
        $next = $last !== null && ($groups->count() > self::PAGE_SIZE || ($cursor !== null && $direction === 'previous'))
            ? $this->cursor('next', QueueTargetIdentity::fromRow($last))
            : null;

        return [$page, $previous, $next];
    }

    private function cursor(string $direction, QueueTargetIdentity $target): string
    {
        return $this->cursors->encode('queue-targets', [
            'direction' => $direction,
            ...$target->cursor(),
        ]);
    }
}
