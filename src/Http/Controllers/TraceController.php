<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\TraceQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class TraceController
{
    public function __construct(
        private TraceQuery $traces,
        private ApiResponder $responses,
    ) {}

    public function __invoke(Request $request, string $run): Response
    {
        return $this->responses->execute(function () use ($request, $run): Response {
            $data = $this->traces->get($run, $request);
            $etag = '"trace-'.$data['run']['traceId'].'-'.$data['trace']['revision'].'"';

            if ($request->headers->get('If-None-Match') === $etag) {
                return response('', 304)->header('ETag', $etag);
            }

            return response()->json($data)->header('ETag', $etag);
        });
    }
}
