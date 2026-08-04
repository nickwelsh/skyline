<?php

namespace NickWelsh\Skyline\Http\Controllers;

use Illuminate\Http\Request;
use NickWelsh\Skyline\Http\ApiResponder;
use NickWelsh\Skyline\Read\NodeQuery;
use Symfony\Component\HttpFoundation\Response;

final readonly class NodeController
{
    public function __construct(
        private NodeQuery $nodes,
        private ApiResponder $responses,
    ) {}

    public function __invoke(Request $request, string $run, string $node): Response
    {
        return $this->responses->execute(function () use ($request, $run, $node): Response {
            $data = $this->nodes->get($run, $node);
            $etag = '"node-'.$run.'-'.$node.'-'.$data['traceRevision'].'"';

            if ($request->headers->get('If-None-Match') === $etag) {
                return response('', 304)->header('ETag', $etag);
            }

            return response()->json($data)->header('ETag', $etag);
        });
    }
}
