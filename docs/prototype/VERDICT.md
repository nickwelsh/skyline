# Trigger interface with Skyline trace data

## Question

Can Trigger.dev's pinned Runs and trace-viewer interface consume Skyline's Runs, Trace, and Inspector DTOs without redesign?

## Verdict

Yes. Nick validated the runnable prototype as “perfect” on 2026-08-04. Representative success, retry with child Run, and final-failure DTOs fit the retained shell, Runs table, hierarchy, timing bars, filters, selected-subtree navigation, detail sidebar, metadata, exceptions, keyboard controls, and resizable layout without a new visual system.

The prototype proves the adapter/data fit with Trigger's pinned stylesheet and Timeline source plus adapted route composition. It intentionally does not replace the implementation requirement in ADR 0001 to vendor the complete reachable Trigger component closure; this branch is throwaway evidence, not production source.

## Verification

- `pnpm run build`
- Runs search and status filtering
- Run-to-Trace navigation with `tableState`
- Retry, child-Run, SQL, and failure hierarchy
- Errors-only ancestor preservation
- Trace text search
- Queue-time toggle
- Root/parent navigation
- Overview, Detail, Context, and Metadata inspector tabs
- Structured exception presentation
- Keyboard expand/collapse
- Browser console free of errors
