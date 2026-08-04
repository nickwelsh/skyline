<?php

namespace NickWelsh\Skyline\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\Access\Gate;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class Authorize
{
    public function __construct(private Gate $gate) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->gate->authorize('viewSkyline');

        return $next($request);
    }
}
