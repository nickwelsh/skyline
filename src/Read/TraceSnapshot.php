<?php

namespace NickWelsh\Skyline\Read;

use Illuminate\Support\Collection;

final readonly class TraceSnapshot
{
    public function __construct(
        public object $trace,
        public object $selectedRun,
        public Collection $runs,
        public Collection $attempts,
        public Collection $spans,
    ) {}

    /** @return list<string> */
    public function runIds(): array
    {
        return $this->runs->pluck('run_id')->all();
    }
}
