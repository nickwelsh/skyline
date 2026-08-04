<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\RunsQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class RunsController
{
    public function __construct(
        private RunsQuery $runs,
        private ApiResponder $responses,
    ) {}

    public function index(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->runs->page($request)));
    }

    public function updates(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->runs->updates($request)));
    }
}
