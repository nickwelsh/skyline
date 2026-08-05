# PROTOTYPE — static React Router seam

Question: can a static React Router data router preserve pinned Remix client imports and observable navigation/loading behavior while Skyline owns loaders and ships no Node server?

Assumption: this is a compatibility-behavior prototype, not a visual prototype. One pinned component is copied byte-for-byte. Small external modules stand in for its unreached visual dependency closure so the router seam stays visible.

Run:

```sh
pnpm --dir prototype-static-react-router-seam dev
```

Open <http://127.0.0.1:4175/skyline/runs>.

Try Next/Previous, open a Run, go back, revalidate, and background refresh. The state panel exposes the browser URL, router location, navigation state, fetcher state, and loader result.

Throw this directory away after the ticket decision is captured.

## Verdict

Validated with Nick on 2026-08-05. Keep pinned client imports unchanged, resolve Remix client APIs through an external React Router compatibility module, and keep Skyline route loaders/data outside vendored source.
