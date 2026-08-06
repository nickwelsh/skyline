<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\ErrorGroupsQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class ErrorGroupsController
{
    public function __construct(
        private ErrorGroupsQuery $errors,
        private ApiResponder $responses,
    ) {}

    public function index(Request $request): Response
    {
        return $this->responses->execute(fn () => response()->json($this->errors->page($request)));
    }

    public function show(Request $request, string $error): Response
    {
        return $this->responses->execute(fn () => response()->json($this->errors->detail($request, $error)));
    }
}
