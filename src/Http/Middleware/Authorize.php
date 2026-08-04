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
        if (! $this->gate->allows('viewSkyline')) {
            if ($request->routeIs('skyline.api.*')) {
                return response()->json([
                    'error' => [
                        'code' => 'forbidden',
                        'message' => 'This request is not authorized to view Skyline.',
                    ],
                ], 403, ['Cache-Control' => 'private, no-store']);
            }

            abort(403);
        }

        return $next($request);
    }
}
