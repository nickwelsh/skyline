# Skyline × Trigger UI prototype

> PROTOTYPE — throwaway integration proof, not production code.

Question: can pinned Trigger.dev interface structure and styling consume Skyline's agreed Runs, Trace, and Inspector DTOs without redesign?

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173/skyline/`. Switch representative data with `?scenario=success`, `?scenario=retry`, or `?scenario=failure`.

Trigger-derived CSS and timeline source are pinned to `triggerdotdev/trigger.dev@ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0`, Apache-2.0. Skyline-specific files are fixture DTOs, routing, and adapters only.
