<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\JobsQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class JobsController
{
    public function __construct(
        private JobsQuery $jobs,
        private ApiResponder $responses,
    ) {}

    public function index(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->jobs->page($request)));
    }

    public function show(Request $request, string $job): Response
    {
        return $this->responses->execute(fn () => response()->json($this->jobs->detail($request, $job)));
    }
}
