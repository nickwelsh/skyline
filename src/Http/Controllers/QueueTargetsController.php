<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\QueueTargetsQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class QueueTargetsController
{
    public function __construct(
        private QueueTargetsQuery $queues,
        private ApiResponder $responses,
    ) {}

    public function index(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->queues->page($request)));
    }

    public function show(Request $request, string $queue): Response
    {
        return $this->responses->execute(fn () => response()->json($this->queues->detail($request, $queue)));
    }
}
