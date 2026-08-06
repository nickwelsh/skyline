<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\TelemetryEventsQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class TelemetryEventsController
{
    public function __construct(
        private TelemetryEventsQuery $events,
        private ApiResponder $responses,
    ) {}

    public function index(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->events->page($request)));
    }

    public function show(string $event): Response
    {
        return $this->responses->execute(fn () => response()->json($this->events->detail($event)));
    }
}
