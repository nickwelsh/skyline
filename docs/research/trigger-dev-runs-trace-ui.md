# Trigger.dev Runs and trace UI audit

## Audit pin

- Repository: [`triggerdotdev/trigger.dev`](https://github.com/triggerdotdev/trigger.dev)
- Commit: [`ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0`](https://github.com/triggerdotdev/trigger.dev/commit/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0), authored 2026-08-04
- Audited surface: application shell, Runs index, Run trace tree/timeline, controls, inspector, styles, assets, build manifest, and repository license material

All paths and findings below refer to that immutable commit.

## Answer

Trigger.dev does not publish this UI as a reusable package. `apps/webapp` is a private application, and the visual components are composed inside Remix routes rather than exported from a design-system workspace. Its loaders and presenters depend on Trigger.dev's auth, Prisma/run stores, ClickHouse, Redis-backed preferences, and product-specific schemas. [The webapp manifest declares it private and shows the Remix/Vite build](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/package.json#L2-L24); [the Runs loader constructs a Trigger-specific presenter backed by Postgres and ClickHouse](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs._index/route.tsx#L82-L124).

The smallest faithful strategy is therefore a **pinned vendored frontend slice**, not a runtime dependency on Trigger.dev:

1. Copy the applicable visual source and preserve its structure, interactions, styling, and notices.
2. Remove Trigger-only features from the copied routes, but retain their layout rather than redesigning it.
3. Replace Remix loaders, presenters, route builders, organization/project/environment hooks, and Trigger domain types with a narrow Skyline API adapter.
4. Build the slice into versioned static assets before packaging. A consuming Laravel app receives compiled JS/CSS/fonts only and needs no Node runtime.
5. Record the source commit and copied-file manifest so later upstream refreshes are reviewable diffs.

Do not fork the entire Trigger.dev webapp. That would import thousands of unrelated product, infrastructure, and server files while still requiring extensive rewrites. Do not redraw the viewer from the screenshot either: its most important behavior is implemented in source and is easy to lose through imitation.

## Exact source map

### Application frame

| Concern | Source | What Skyline should retain |
| --- | --- | --- |
| Root document | [`apps/webapp/app/root.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/root.tsx#L1-L213) | Geist imports, full-height/overflow contract, antialiasing, theme attributes, and stylesheet loading. Drop analytics, auth, toasts, and Remix document wiring. |
| Shell composition | [`...projects.$projectParam/route.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam/route.tsx#L1-L40) | Two-column side-menu/main-body grid. |
| Layout primitives | [`components/layout/AppLayout.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/layout/AppLayout.tsx#L1-L100) | `AppContainer`, `MainBody`, `PageContainer`, and `PageBody`. |
| Side menu | [`components/navigation/SideMenu.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenu.tsx#L231-L304), [`SideMenuItem.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenuItem.tsx#L1-L282), [`SideMenuHeader.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenuHeader.tsx#L1-L66) | Exact width, collapse/resize behavior, label fade, active-row treatment, tooltip behavior, and header density. Extract a Skyline-specific shell containing only Skyline branding and Runs; the upstream `SideMenu` itself is over 2,500 lines and coupled to every Trigger product destination. |
| Page header | [`components/primitives/PageHeader.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/PageHeader.tsx#L1-L90) | 40px navigation bar, title/breadcrumb treatment, loading divider, and accessories placement. Remove agent launcher, organization banner, favorites, docs, replay, and cancel controls. |

The current side menu is resizable from 44px collapsed through 224px default to 400px maximum, with CSS-variable-driven label fading and snap behavior. Those values and mechanics live directly in `SideMenu.tsx`, not in a reusable library. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenu.tsx#L231-L304).

### Runs index

| Concern | Source | Role |
| --- | --- | --- |
| Page composition | [`runs._index/route.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs._index/route.tsx#L155-L430) | Header, filter bar, table, new-runs indicator, loading/empty states, pagination, and optional inspector layout. |
| Runs table | [`components/runs/v3/TaskRunsTable.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/TaskRunsTable.tsx#L1-L590) | Sticky dense table, cell navigation, status/timing rendering, row actions, and propagation of list state into the Run URL. Adapt columns to Skyline's accepted fields; omit Trigger-only version, machine, region, cost, test, TTL, tags, cancel, and replay UI. |
| Filters | [`components/runs/v3/RunFilters.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/RunFilters.tsx#L1-L404), [`SharedFilters.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/SharedFilters.tsx) | URL-owned filter menu, applied-filter chips, time range, status, task, queue, and Run-ID patterns. Keep only Skyline's status, Job, queue, time, and ID/name search controls. |
| Pagination | [`components/ListPagination.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/ListPagination.tsx#L1-L90) | Explicit Previous/Next cursor controls with `j`/`k` shortcuts. |
| Live list updates | [`runs._index/useRunsLiveReload.ts`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs._index/useRunsLiveReload.ts#L1-L284) | Polls active rows, patches their state, detects new Runs, and shows a user-controlled refresh badge without disturbing the current page. |
| Status visuals | [`TaskRunStatus.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/TaskRunStatus.tsx), [`RunStatusCellTooltip.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/RunStatusCellTooltip.tsx), [`LiveTimer.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/LiveTimer.tsx) | Color, icon, label, tooltip, and ticking-duration patterns. Map Laravel statuses into the reduced Skyline enum. |

Trigger.dev currently uses **cursor pagination, not infinite scroll**. Its presenter defaults to 25 rows and returns `next`/`previous` cursors; the page renders explicit controls. [Presenter source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/NextRunListPresenter.server.ts#L50-L88), [return contract](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/NextRunListPresenter.server.ts#L297-L359), [control source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/ListPagination.tsx#L17-L89). Active rows are polled every 3 seconds and new-run counts approximately every 6 seconds. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs._index/useRunsLiveReload.ts#L7-L12).

### Trace viewer and inspector

| Concern | Source | Role |
| --- | --- | --- |
| Viewer composition and behavior | [`runs.$runParam/route.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L427-L2077) | This is the core artifact. `TraceView`, `TasksTreeView`, `TimelineView`, rows, current-time cursor, relationship links, zoom, search, switches, keyboard shortcuts, adjacent-run navigation, and resizable inspector are inline in one route file. They are not independent exported components. |
| Inspector | [`resources...spans.$spanParam/route.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L135-L520) | Lazy-loads a selected node and renders the Run/span inspector. `RunBody` supplies Overview/Detail/Context/Metadata tabs; `SpanBody`/`SpanEntity` supply generic span status, timeline, events, properties, and child Runs. |
| Generic inspector body | [same file, `SpanEntity`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1515-L1772) | Use normal span and attempt branches. Drop waitpoint, streaming, AI, prompt, payload/output, queue analytics, trace export, and Trigger-specific entity branches. Add Skyline exception presentation inside the existing Overview/body pattern. |
| Tree state and virtualization | [`TreeView/TreeView.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/TreeView.tsx), [`reducer.ts`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/reducer.ts), [`utils.ts`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/utils.ts) | Flat-tree contract, keyboard navigation, visibility/filter state, expansion, selection, and virtualized rows. Copy as a unit. |
| Timeline geometry | [`components/primitives/Timeline.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Timeline.tsx) | Absolute point/span placement, scale interpolation, ticks, and cursor-following. |
| Split panels | [`components/primitives/Resizable.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Resizable.tsx) | Tree/timeline and viewer/inspector resizing, handles, collapsing, and Firefox animation guard. |
| Run lifecycle timeline | [`components/run/RunTimeline.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/run/RunTimeline.tsx) | Triggered/dequeued/started/finished vertical timeline in the Run inspector. Map Skyline lifecycle timestamps into this presentation. |
| Trace rows | [`RunIcon.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/RunIcon.tsx), [`SpanTitle.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/SpanTitle.tsx), [`SpanEvents.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/SpanEvents.tsx) | Job/Attempt/query icons, title/accessory rendering, success/error/partial colors, and event display. `RunIcon` already has `task`, `attempt`, and `query` variants applicable to Skyline. |

Supporting primitives form a real dependency closure rather than optional decoration: `Badge`, `Buttons`, `Callout`, `CodeBlock`, `CopyableText`, `DateTime`, `Headers`, `InfoPanel`, `Paragraph`, `Popover`, `PropertyTable`, `SearchInput`, `ShortcutKey`, `Slider`, `Switch`, `Tabs`, `Table`, and `Tooltip` under `apps/webapp/app/components/primitives/`, plus `utils/cn.ts`, `utils/lerp.ts`, and the small debouncing/shortcut/dimension hooks. Copy only the primitives reached by the retained UI, but do not substitute visually similar components from another kit.

## Interaction contract to preserve

### Runs

- URL-owned filters; changing a filter clears cursor state.
- Dense sticky table; the entire relevant cell region navigates to a Run.
- Cursor Previous/Next controls with `j`/`k` shortcuts.
- The list query state is encoded into `tableState` on the Run link, letting the detail view return to the same filters/page and find adjacent Runs. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/TaskRunsTable.tsx#L118-L133).
- Live active-row patching; newly-created Runs produce a refresh badge instead of silently shifting the table.

### Trace

- Debounced text search and Errors-only filtering.
- Queue-time switch: hidden by default by subtracting `queuedDuration`; shown by restoring the original offsets. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L897-L999).
- Synchronized vertical scrolling between tree and timeline, with virtualized 32px rows.
- Click selection shared between row and bar; selected span opens the right inspector and is represented by the `span` URL parameter.
- Chevron expand/collapse; Alt-click expands or collapses descendants.
- Arrow-key tree navigation, Home/End, Escape to deselect, `E` expand all, `W` collapse all, `0`–`9` toggle depth, `Q` queue time, and adjacent-Run keys. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1850-L1944).
- Timeline ticks, hover-following time cursor, live in-progress duration, zoom slider, success/error/partial bars, and event dots.
- Two independently resizable splits: tree/timeline and viewer/inspector. Selecting/deselecting controls inspector collapse.
- Run/span inspector tabs and Escape close. Skyline should omit unsupported content while retaining the remaining layout and control positions.

## Data contracts Skyline must feed

The copied view should depend on Skyline-owned DTOs matching the UI's needs, not Trigger.dev database types.

### Runs list DTO

The upstream presenter returns `{ runs, pagination, possibleTasks, bulkActions, filters, hasFilters, hasAnyRuns }`. Each row includes IDs, timestamps, status, task name, span ID, completion booleans, queue, and extensive Trigger-only fields. [Exact return shape](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/NextRunListPresenter.server.ts#L297-L359).

Skyline's adapter needs only:

```ts
type RunsPage = {
  runs: Array<{
    id: string;
    name: string;
    status: "queued" | "running" | "retrying" | "completed" | "failed";
    connection: string;
    queue: string;
    attemptCount: number;
    queuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    queueDurationMs?: number;
    durationMs?: number;
  }>;
  pagination: { next?: string; previous?: string };
  hasAnyRuns: boolean;
};
```

### Trace DTO

The tree consumes a flat pre-order array. Every item has `id`, optional `parentId`/`runId`, child IDs, `hasChildren`, indentation `level`, and `data`. [Flat-tree type](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/TreeView.tsx#L568-L610). The presenter adds nanosecond `offset`, nullable nanosecond `duration`, status flags, style, level, and derived timeline events, then wraps it with total duration, root status/start, and queued duration. [Transformation and wrapper](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunPresenter.server.ts#L300-L374).

Skyline should expose:

```ts
type TracePage = {
  run: {
    id: string;
    name: string;
    traceId: string;
    rootRunId?: string;
    parentRunId?: string;
  };
  trace: {
    rootSpanStatus: "executing" | "completed" | "failed";
    durationNs: number;
    rootStartedAt: string;
    queuedDurationNs?: number;
    events: Array<{
      id: string;
      parentId?: string;
      runId?: string;
      children: string[];
      hasChildren: boolean;
      level: number;
      data: {
        message: string;
        kind: "run" | "attempt" | "query" | "event";
        level: "TRACE" | "INFO" | "WARN" | "ERROR";
        offsetNs: number;
        durationNs: number | null;
        isError: boolean;
        isPartial: boolean;
        isCancelled: boolean;
        timelineEvents: Array<{ name: string; offsetNs: number }>;
      };
    }>;
  };
};
```

Map `kind` to Trigger's existing `RunIcon` names (`task`, `attempt`, `query`, `info`) and map status to existing style variants at the adapter boundary. Keep OTel/storage objects out of React.

### Inspector DTO

The selected-node endpoint is a discriminated union: Run or span. The generic span branch needs ID/parent, message, start/duration, error/partial/cancel flags, level, events, properties/resource properties, and triggered child Runs. [Upstream selection and generic span shape](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/SpanPresenter.server.ts#L632-L714). Skyline may add sanitized exception class/message/stack to the existing properties/error area; it need not emulate Trigger's payload, output, AI, waitpoint, prompt, stream, cost, machine, idempotency, or queue-analytics entities.

## Styles and assets

- Copy `apps/webapp/app/tailwind.css` as the visual authority, then remove only demonstrably unreachable product-specific blocks. It contains the raw palette, semantic surface/border/status tokens, theme selectors, focus treatment, scrollbars, and timeline light-theme corrections. [Token source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/tailwind.css#L1-L220), [theme and timeline rules](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/tailwind.css#L754-L916).
- Preserve `data-theme="classic"` for the accepted dark MVP appearance. Trigger's root imports `non.geist` and `non.geist/mono`; Vite rebases their WOFF2 URLs into built assets. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/root.tsx#L8-L13).
- Copy applicable custom icon components: `RunsIcon.tsx`, `TaskIcon.tsx`, `AttemptIcon.tsx`, `InfoIcon.tsx`, `TraceIcon.tsx`, `RunFunctionIcon.tsx`, `ExitIcon.tsx`, and adjacent-navigation icons. Use installed Heroicons/Tabler packages for their icons rather than copying their source.
- `RunIcon.tsx` can be narrowed to Skyline's `task`, `attempt`, `query`, and informational/error variants. Doing so avoids shipping the megabyte `components/primitives/tabler-sprite.svg`, AI-provider marks, Python mark, and other irrelevant assets.
- Do not copy Trigger.dev logos, wordmarks, product screenshots, or third-party brand assets. Skyline supplies its own logo in the retained shell.

## Dependency and build implications

The retained slice's direct client dependencies are React/ReactDOM, `@heroicons/react`, `@tanstack/react-virtual`, `framer-motion`, `react-hotkeys-hook`, `@window-splitter/react`, and the Radix packages behind popover/tooltip/slider/switch/tabs. Retaining the current filter implementation also requires Ariakit, Tabler React icons, `match-sorter`, and Zod. The exact upstream versions are in the webapp manifest. [Manifest](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/package.json#L29-L199).

Build constraints:

- Upstream uses React 18.3.1 via a workspace override, Remix 2.17.5, Vite 6.4.2, Tailwind 4.3.1, and pnpm 10.33.2. [Root workspace versions](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/package.json#L76-L103), [webapp tools](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/package.json#L227-L276).
- Skyline need not retain Remix server rendering. Replace Remix `Link`, search-param, navigation, fetcher, and loader usage with the frontend router/fetch layer selected for Skyline, while leaving markup/classes/state mechanics intact.
- Do not depend on `@trigger.dev/core` or `@trigger.dev/database` just for formatting and types. Their imports pull the copied components toward Trigger's domain; reimplement the tiny duration/nanosecond helpers and own the DTO types. Those packages also carry their own MIT license rather than the repository-root Apache license. [Core license](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/packages/core/LICENSE).
- The resizable behavior is not reproducible from `@window-splitter/react@1.1.3` alone. Trigger applies a patch to `@window-splitter/state@1.1.3` that disables drag-to-collapse and changes first expansion to prefer the configured default size. [Patch registration](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/package.json#L84-L94), [patch](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/patches/%40window-splitter__state%401.1.3.patch). Carry the pinned patch in Skyline's contributor build or vendor an equivalent patched splitter; otherwise collapse/drag behavior will drift.
- Trigger stores panel snapshots in cookies and guards Firefox collapse animation using a server-derived browser flag. [Snapshot reader](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/services/resizablePanel.server.ts), [Firefox guard](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Resizable.tsx#L14-L37). Skyline can reproduce the same observable behavior with local storage/client detection because it ships a precompiled SPA, but should preserve IDs/default/min/collapse animation.
- The contributor build must compile Tailwind against every vendored TSX file and bundle Geist font assets. The released Composer artifact should contain only compiled, fingerprinted assets and the attribution files.

## Licensing and attribution

The repository presents the webapp source under its root Apache License 2.0. That permits copying and modification, subject to redistribution conditions: ship the license, mark modified files prominently, retain applicable notices, and reproduce a repository `NOTICE` if one exists. [License clauses 4(a)-4(d)](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/LICENSE#L89-L121). This commit has no root `NOTICE` file.

Recommended Skyline compliance:

1. Add the Trigger.dev Apache 2.0 text to Skyline's distributed third-party licenses.
2. Add `THIRD_PARTY_NOTICES.md` naming Trigger.dev, the pinned commit, copied paths, and Skyline modifications.
3. Put a short `Derived from Trigger.dev; modified for Skyline` notice with the upstream path/commit in each materially copied source file. Generated bundles should retain a license banner or ship beside the notices.
4. Preserve any source-local copyright/attribution notice encountered during extraction.
5. Keep dependency licenses in the built artifact's third-party license inventory.

Not everything reachable from the UI is Apache-2.0 material:

- `@trigger.dev/core` and other published Trigger packages have nested MIT licenses; copied code from them must carry the MIT notice. [Example](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/packages/core/LICENSE).
- Heroicons, Tabler, Geist, Radix, Ariakit, Framer Motion, `@window-splitter`, and other npm dependencies are third-party works governed by their own licenses, not Trigger.dev's root license. Prefer depending on them rather than copying their implementation/assets, and audit the final lockfile separately.
- Apache 2.0 does not grant rights to Trigger.dev trade names, trademarks, service marks, or product names except customary attribution. [Clause 6](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/LICENSE#L138-L141). Do not ship Trigger.dev branding, logo/wordmark, or imply endorsement.
- The generated Tabler sprite, third-party provider logos, Trigger.dev logo/wordmark, and product screenshots are unnecessary for Skyline's accepted surface and should not be copied.

## Extraction decision

Vendor one pinned `trigger-ui` source slice with three Skyline adapters:

1. `RunsPageAdapter`: Laravel JSON -> retained filters/table/pagination/live-refresh UI.
2. `TracePageAdapter`: OTel-derived flat trace DTO -> retained tree/timeline UI.
3. `InspectorAdapter`: selected Run/Attempt/query -> retained generic inspector and lifecycle timeline.

Keep Trigger's exact applicable markup, Tailwind classes, primitives, interactions, keyboard shortcuts, panel geometry, and dark shell. Rename only product copy/branding, replace data/routing seams, remove unsupported controls and branches, and add no bespoke visual component unless the pinned source lacks an applicable equivalent.

This makes fidelity testable: compare Skyline and the pinned Trigger source at fixed desktop fixtures, and treat differences outside branding/data/unsupported-feature removal as regressions.
