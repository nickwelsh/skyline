# Trigger.dev run-detail route audit

## Audit pin

- Repository: [`triggerdotdev/trigger.dev`](https://github.com/triggerdotdev/trigger.dev)
- Commit: [`ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0`](https://github.com/triggerdotdev/trigger.dev/commit/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0)
- Primary route: [`apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx)
- Scope: direct imports, loader and presenter flow, trace tree/timeline, inspector, navigation, live refresh, unsupported Trigger.dev features, and the Skyline DTO seam

All upstream paths below refer to that immutable commit.

## Bottom line

The route is large because it contains **two different programs in one file**:

1. A Trigger.dev-specific Remix server route: authentication, RBAC, Postgres/run-store reads, ClickHouse trace reads, Redis-buffer fallbacks, saved panel cookies, run-list pagination context, redirects, and SSE revalidation.
2. A mostly portable client viewer: page header, two nested split panes, virtualized tree, timeline geometry, filters, selection, keyboard navigation, adjacent-run navigation, and the inspector boundary.

The route itself is 2,078 lines and has 77 direct import declarations exposing 124 bindings (115 runtime, 9 type-only). Its import block is not one indivisible UI dependency. The first 123 lines mix portable visual dependencies, Trigger.dev domain components, Remix plumbing, and server infrastructure. [Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1-L123)

Skyline should copy the client composition nearly verbatim, then replace only these seams:

- `loader`/`RunPresenter` with `SkylineDtoAdapter.trace()`;
- Trigger's `TraceEvent` with a narrow mapper from `TracePageDto.trace.nodes`;
- `SpanView`'s resource fetch with `SkylineDtoAdapter.inspector()`;
- Remix route/search helpers with Skyline navigation;
- SSE revalidation with Skyline's existing bounded polling contract;
- Trigger-only actions and inspector sections with hidden/commented placeholders.

Skyline's current DTOs already contain the flat tree, offsets, durations, statuses, timeline events, truncation, polling, relationships, adjacent navigation, and rich inspector discriminators required by that plan. [`TraceNode` and `TracePageDto`](../../resources/js/skyline/dto.ts#L56-L142), [`InspectorDto`](../../resources/js/skyline/dto.ts#L144-L247)

## Route composition

| Route section | Lines | Responsibility | Skyline treatment |
| --- | ---: | --- | --- |
| Imports and panel constants | 1–158 | Dependency closure and exact panel IDs/sizes | Retain client-side constants; remove server imports. |
| List-context loader helper | 160–259 | Rebuild Runs filters from `tableState`; fetch previous/next page boundary Runs | Replace with `TracePageDto.navigation`. |
| Permissions and loader | 261–415 | Auth, environment correction, main presenter, Redis-buffer fallback, root selection redirect, panel cookies, action permissions | Replace entirely with Skyline adapter/loading states. |
| Page/header | 419–562 | Back link, copyable Run ID, adjacent buttons, debug metadata, docs/replay/cancel controls, trace/no-trace branch | Preserve layout; hide unsupported controls. |
| Trace/inspector split | 564–745 | Selection URL, live reload, truncated callout, outer split, lazy inspector | Preserve composition; adapt URL, polling, and inspector fetch. |
| No-logs view | 748–844 | Subscription retention/upgrade messaging | Do not copy product/billing logic. |
| Tree view | 846–1205 | Search, switches, tree state, synchronized split, footer controls | Copy closely. |
| Timeline view | 1207–1538 | Duration clock, ticks, virtual rows, bars/points/events, scroll synchronization | Copy closely with unit adapter. |
| Node/relationship/live UI | 1541–1732 | Titles, icons, statuses, parent/root links, live indicator | Adapt statuses/icons/paths. |
| Bars, hover time, shortcuts | 1734–1966 | Partial fill, duration labels, cursor timestamp, keyboard help/actions | Copy closely. |
| Adjacent-run paths/buttons | 1968–2077 | Cursor-bound previous/next URLs and hotkeys | Use Skyline navigation fields. |

[Primary route source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L126-L2077)

## Direct import audit

The 77 imports fall into seven coherent groups. This is the practical answer to the apparently enormous dependency block.

### 1. External packages: 10

| Modules | Role | Keep? |
| --- | --- | --- |
| `@heroicons/react/20/solid` | Header, tree, status, and zoom icons | Yes, for used icons. |
| `@tanstack/react-virtual` | Shared virtualizer type; the implementation is created by `useTree` | Yes. |
| `framer-motion` | Stable bar/point layout animation during live updates | Yes. |
| `react`, `react-hotkeys-hook` | State/effects and numeric depth hotkeys | Yes. |
| `@remix-run/react`, `@remix-run/server-runtime`, `remix-typedjson` | Loader data, revalidation, serialization, redirects | No; replace with Skyline SPA/API code. |
| `@trigger.dev/core/v3` | Duration formatting/conversion and `tryCatch` | Replace with Skyline-owned helpers; do not import Trigger's domain package. |
| `@trigger.dev/database` | Environment type only | No. |

The exact external imports are visible at the top of the route. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1-L26)

### 2. Assets: 5

- `ChevronExtraSmallDown`, `ChevronExtraSmallUp`: adjacent Run controls.
- `MoveToTopIcon`, `MoveUpIcon`: root/parent Run links.
- `error-banner-tile@2x.png`: animated partial/in-progress bar texture.

Keep these visual assets or their already-vendored exact equivalents. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L27-L31)

### 3. Shared UI and layout: 25

`DevPresence`, `WarmStarts`, `admin/debugTooltip`, `AppLayout`, `Badge`, `Buttons`, `Callout`, `CopyableText`, `DateTime`, `Dialog`, `Headers`, `InfoPanel`, `SearchInput`, `PageHeader`, `Paragraph`, `Popover`, `PropertyTable`, `Resizable`, `ShortcutKey`, `Slider`, `Switch`, `Timeline`, `Tooltip`, `TreeView`, and the TreeView `reducer`.

Most primitives are portable and should remain structurally intact. Three are product-specific:

- `DevPresence` is Trigger.dev development-engine connectivity, not generic trace polling.
- `WarmStarts` only applies to Trigger task attempts.
- `admin/debugTooltip` exposes Trigger internal IDs.

The resizable import is especially important: it supplies both nested split-pane components, collapse animation, a frozen last value during inspector close, and the handle visibility class. [Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L32-L74), [Resizable implementation](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Resizable.tsx#L1-L116)

### 4. Run-specific UI: 6

| Module | What the route uses | Skyline treatment |
| --- | --- | --- |
| `CancelRunDialog` | Header action and redirect | Hide/comment placeholder. |
| `ReplayRunDialog` | Header action and redirect | Hide/comment placeholder. |
| `RunFilters` | Decode list `tableState` | Use Skyline navigation DTO; do not import the full filter component. |
| `RunIcon` | Node-kind icon selection | Retain a narrowed version mapped from Skyline `NodeKind`. |
| `SpanTitle` | Label/accessory and status colors; bar/event colors | Retain markup/color functions; feed Skyline view model. |
| `TaskRunStatus` | Row status icons/colors | Keep presentation but replace Trigger's 18-state domain with Skyline statuses. |

[Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L75-L89), [`RunIcon` cases](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/RunIcon.tsx#L53-L250), [`SpanTitle` colors/accessories](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/SpanTitle.tsx#L9-L269), [`TaskRunStatus` domain](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/runs/v3/TaskRunStatus.tsx#L22-L296)

### 5. Client context and hooks: 10

`useDebounce`, `useEnvironment`, `useEventSource`, `useInitialDimensions`, `useOrganization`, `useProject`, `useReplaceSearchParams`, `useSearchParams`, `useShortcutKeys`, and `useHasAdminAccess`.

Keep/recreate the small generic behaviors—debounce, initial dimensions, search-param replacement, and shortcut handling. Remove organization/project/environment/admin contexts. Replace `useEventSource` with Skyline's trace polling: Trigger's hook merely opens an `EventSource` and stores the latest event; the route then asks Remix to rerun the entire loader. [Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L91-L102), [`useEventSource`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/hooks/useEventSource.tsx#L1-L43)

### 6. Server/domain loader dependencies: 15

`db.server`, `env.server`, project/environment models, `NextRunListPresenter`, `RunPresenter`, three mollifier helpers, ClickHouse factory, impersonation, logger, resizable-cookie service, session auth, and RBAC.

None belong in the Skyline client. They exist to construct and authorize the route payload, not render it. `RunPresenter` alone reads the run, verifies project membership, resolves the environment, reads the event repository, repairs missing trace anchors, converts the trace to a flat UI tree, and calculates offsets/status/duration. [Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L90-L114), [`RunPresenter`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunPresenter.server.ts#L40-L376)

### 7. Utilities and cross-route imports: 6

`cn`, `lerp`, `pathBuilder`, `SpanOverride`, the organization route's current-plan hook, and the resource route's `SpanView`.

- Keep `cn` and `lerp`.
- Replace Trigger path builders and `SpanOverride` with Skyline navigation/types.
- Remove the billing plan hook.
- Treat `SpanView` as a major imported subsystem, not a primitive. It adds another 1,768-line route plus a 1,092-line presenter and is the source of most sidebar complexity. [Route imports](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L115-L123), [Inspector resource route](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx), [`SpanPresenter`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/SpanPresenter.server.ts)

## Server data flow

### Main loader

1. Require a user; read impersonation state; parse organization/project/environment/Run parameters; read `showDebug`.
2. Call `RunPresenter`.
3. Redirect an environment mismatch to the environment-independent Run route.
4. Only on the typed `RunNotInPgError`, try the Redis mollifier buffer. Other downstream failures are rethrown rather than masked.
5. On a direct initial request without `span`, redirect to the same URL with the root span selected. `_data` requests are excluded.
6. Read both resizable panel snapshots from cookies.
7. Decode `tableState` and load the current Runs page to calculate adjacent navigation, including one-item boundary queries into the preceding/following page.
8. Compute display-only replay/cancel permissions and serialize the result.

[Loader and fallback](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L160-L415)

### `RunPresenter`

The presenter is the exact adapter from Trigger's storage model to the route's view model:

- It reads the Run and related root/parent headers, verifies project membership, resolves the environment, and rejects a slug mismatch.
- It returns no trace when logs were deleted.
- It fetches a trace summary from the correct event repository, then requests an anchored subtree if a large trace omitted the selected Run's span.
- If no summary exists, it synthesizes a one-node root from Run status.
- It constructs a tree anchored at the Run's span, flattens it pre-order, derives nanosecond offsets and timeline events, nulls partial durations, marks the root/agent rows, and records cached-span linked Runs.
- It returns total duration (minimum 1 ms), root status, root start, queue duration, span overrides, truncation state, and missing-anchor state.

[Storage/auth/header projection](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunPresenter.server.ts#L40-L184), [trace lookup and fallback](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunPresenter.server.ts#L186-L266), [tree projection](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunPresenter.server.ts#L268-L376)

Skyline has already performed this equivalent storage-to-view transformation in PHP. `TraceViewBuilder` produces ordered flat nodes, relationships, queue/duration values, truncation, and polling state; React should consume that contract instead of recreating Trigger's presenter. [`TraceViewBuilder`](../../src/Read/TraceViewBuilder.php)

## Page and trace composition

### Header

The header contains:

- a Runs back link reconstructed from `tableState` filters;
- copyable friendly Run ID;
- previous/next Run buttons when list context exists;
- development-disconnected banner;
- admin-only internal IDs;
- Run docs;
- replay and cancel actions.

[Header composition](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L419-L562)

Only the back link, ID, and adjacent navigation are core to Skyline. Preserve the accessory region so future controls can be restored without changing layout.

### Outer inspector split

`TraceView` uses a horizontal `ResizablePanelGroup`: trace content has a 100 px minimum; the inspector defaults to 500 px, has a 250 px minimum, and collapses to zero over 300 ms when no `span` is selected. `useFrozenValue` retains the last inspector ID/data during close animation. Selection is written to the URL after a 250 ms debounce; deselection closes immediately. [Panel constants](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L126-L158), [`TraceView`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L564-L704)

### Live refresh

Live refresh is allowed when the event count is at or below the repository limit and the Run is active or finished less than 30 seconds ago. The client opens an authenticated SSE route; any message calls Remix `revalidate()`, rerunning the full loader. The stream throttles trace pub/sub notifications to one per second, pings every five seconds, and times out after 30 seconds. [Client gate and revalidation](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L564-L652), [SSE presenter](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/presenters/v3/RunStreamPresenter.server.ts#L13-L188)

Skyline's `TracePageDto` already supplies `polling`, `pollIntervalMs`, and `pollUntil`; retain Trigger's live/disabled indicator but derive its state from those fields. [`TracePageDto.trace`](../../resources/js/skyline/dto.ts#L122-L135)

## Tree behavior

`TasksTreeView` is a three-row layout: 40 px filters, flexible tree/timeline split, and 52 px footer. The inner split defaults to 50/50 with 50 px minimum panels. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L846-L1205)

Its behavior:

- Search is debounced 250 ms and matches case-insensitive message text.
- Errors-only retains nodes whose own `isError` is true; ancestors/children are made visible by the tree filter utility.
- Queue time defaults hidden.
- An admin-only Debug switch reloads the server query with debug logs.
- Rows are 32 px high and virtualized with 50-row overscan.
- Tree and timeline vertical scroll positions mirror each other.
- Rows start expanded; selecting a hidden descendant expands its ancestors.
- Clicking a row selects it; clicking the timeline toggles selection.
- Chevron click toggles one node; Alt-click expands/collapses all descendants at or below its depth.
- Home/End select first/last visible nodes; arrows navigate/collapse/expand/parent; Escape deselects.
- `E` expands all, `W` collapses below depth 1, and `0`–`9` toggle a depth.
- Root and parent Run links have `T`/`P` shortcuts.

[`useTree` state/virtualizer](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/TreeView.tsx#L145-L390), [keyboard handling](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/TreeView.tsx#L392-L486), [filter visibility](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/utils.ts#L70-L174), [route shortcuts](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1838-L1966)

The flat input is pre-order and contains `id`, optional `parentId`/`runId`, child IDs, `hasChildren`, `level`, and custom `data`. [`FlatTreeItem`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/TreeView/TreeView.tsx#L568-L610) Skyline's `TraceNode` already matches this structural contract. [`TraceNode`](../../resources/js/skyline/dto.ts#L56-L73)

## Timeline behavior

The timeline uses the same tree state and the same virtualizer, ensuring a row is visible/selected identically on both sides. [Timeline source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1207-L1538)

Important geometry and display rules:

- Trigger's presenter and route use nanoseconds; Timeline primitives receive milliseconds. Skyline uses microseconds, so the adapter must convert once and explicitly.
- Hiding queue time subtracts `queuedDuration` from every offset and the total duration; showing it restores the original origin.
- A live root recomputes duration every 500 ms from `rootStartedAt`.
- Render width interpolates from the initially measured panel width to 10× that width; the slider is `0..1` in `0.05` steps.
- The coordinate range is 105% of current duration, leaving right-side breathing room.
- Five equally distributed ticks are rendered; the last label is omitted, and a completed/failed terminal line is added at exact duration.
- `TRACE` rows render duration bars and event marks. Non-TRACE rows render points.
- Partial bars use the tiled animated overlay. Selected rows always show duration text; other rows obey `showDurations`.
- Hover renders elapsed duration plus absolute time, with the tooltip anchor shifting near both edges.

[`TimelineView`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1231-L1538), [bar and cursor implementation](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1734-L1836), [Timeline primitives](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Timeline.tsx#L1-L215)

## Inspector/sidebar

The apparent sidebar is not implemented in the primary route. `TraceView` imports `SpanView`, which fetches a separate resource route whenever selection changes. The resource loader calls `SpanPresenter`, then returns a discriminated union: `{ type: "run", run, queueMetrics }` or `{ type: "span", span }`. [Resource loader and `SpanView`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L126-L280)

### Run inspector

The Run inspector has a 40 px title, 32 px tabs, scroll body, and footer. Its tabs are:

- **Overview:** status, optional queue-waiting analytics, lifecycle timeline, error, payload, output.
- **Detail:** status, task, Run ID, relationships, batch, session, idempotency/reset, debounce, version/SDK/runtime, test/replay, environment/schedule/queue, TTL/tags/max duration, machine/region, cost/usage/engine/external trace, and admin internals.
- **Context:** formatted task-run context JSON.
- **Metadata:** formatted metadata JSON or docs callout.

The footer has focus/original-Run navigation, admin debug, and trace export. [Run inspector tabs/body](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L385-L1199)

The lifecycle timeline itself is portable. It derives Triggered, waiting-to-dequeue, Dequeued, waiting-to-execute, Started, executing, Finished, and Expired rows from timestamps/status and uses live timers for unfinished intervals. [`RunTimeline`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/run/RunTimeline.tsx#L38-L264)

### Generic span and attempt inspector

A normal span renders:

- status or timestamp;
- horizontal span timeline;
- copyable message;
- span events;
- properties and resource properties;
- a child-Runs table.

An attempt renders the same status/timeline/events/properties shape plus warm-start status. Other entity branches render waitpoints, real-time streams, AI generations/summaries/tool calls/embeddings, and prompts. [Generic span and entity switch](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1515-L1768)

Skyline should retain the title/close/body chrome and normal span/attempt timeline patterns, then render its richer `InspectorDto` discriminators—exception, SQL, HTTP, cache, Redis, storage, mail/notification, process, transaction, custom, summary, breadcrumb, source, and metadata—inside that chrome. It should not emulate Trigger entity types. [`InspectorDto`](../../resources/js/skyline/dto.ts#L144-L247)

## Exact Skyline mapping

Use a single view-model adapter. Do not spread Trigger's expected shape through the component tree.

| Trigger route field | Skyline source | Conversion/decision |
| --- | --- | --- |
| `run.friendlyId`, `run.id` | `run.id` | Same Skyline ID for both display concepts. |
| `run.completedAt` | `run.finishedAt` | Direct nullable timestamp. |
| `run.isFinished` | `run.status` | `completed` or `failed`. |
| `run.spanId` | first/root `trace.nodes[].id` | Selected-node ID, not an OTel span ID assumption. |
| `run.rootTaskRun`, `parentTaskRun` | `run.rootRunId`, `parentRunId` | Build Skyline Run paths; resolve corresponding Run-node ID when selecting. |
| `trace.rootSpanStatus` | `trace.rootStatus` | Rename only. |
| `trace.rootStartedAt` | same | Direct. |
| `trace.duration` | `durationUs ?? activeDurationUs` | Convert µs to ns only if retaining Trigger's internal view model; otherwise convert to ms at Timeline boundary. |
| `trace.queuedDuration` | `queuedDurationUs` | Same unit rule. |
| `trace.events` | `trace.nodes` | Map each flat node. |
| `event.data.message` | `node.label` | Direct. |
| `event.data.level` | `node.kind`/`node.logLevel` | `TRACE` for duration-bearing operation nodes; log level for breadcrumbs/log events. |
| `event.data.style.icon` | `node.kind` | Narrow icon map: run→task, attempt→attempt, query→query, remaining Skyline kinds→their retained icons. |
| `offset`, `duration` | `offsetUs`, `durationUs` | Explicit unit conversion. Preserve `null` as in-progress. |
| `isError`, `isPartial` | same | Direct. `hasErrorDescendant` may drive the partial/error-descendant presentation separately. |
| `isCancelled` | no Skyline equivalent | `false` until the DTO gains a canceled state. |
| `timelineEvents` | same | Convert offsets only. |
| `isRoot` | first/root node | Derived. |
| `isAgentRun` | unavailable | `false`. |
| `isTruncated` | same | Direct; no `missingAnchor` equivalent is needed. |
| Adjacent paths | `navigation.previousRunId`, `nextRunId`, `tableState` | No server-side list replay needed. |
| Inspector selection | `adapter.inspector(nodeId, runId)` | Replace `SpanView` resource route. |

[Skyline run/trace contract](../../resources/js/skyline/dto.ts#L5-L20), [Skyline node/trace contract](../../resources/js/skyline/dto.ts#L56-L142)

## Trigger.dev features to hide, not redesign

Keep layout slots or commented component blocks where future Skyline functionality is plausible.

### Header/route

- Replay Run
- Cancel Run
- Trigger Run docs
- Trigger development presence banner
- Admin ID/debug tooltip and Debug filter
- RBAC display permission plumbing
- Trigger log-retention billing/upgrade states

### Run inspector

- Queue analytics/waiting chart
- Payload/output packets unless Skyline later captures them at Run level
- Batch/session/idempotency/reset/debounce
- deployment/SDK/runtime/test/replay/schedule/TTL/tags/max-duration
- machine/region/cost/usage/Run-engine/external-trace/admin internals
- admin debug
- Focus/original cached Run until Skyline models cached linked Runs
- Export trace, Copy for AI, Markdown/log/JSONL downloads

The export menu performs authenticated fetch/clipboard work and server download routes; it is not a cosmetic button. [Export implementation](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1380-L1438)

### Span entities

- warm-start marker
- waitpoint detail/completion
- real-time stream viewer
- AI generation/summary/tool-call/embed inspector
- prompt inspector
- Trigger child-Run table until Skyline supplies child summary data in `InspectorDto`

Keep Skyline-specific exception and operation capture sections; these are substitutions at the data seam, not visual departures.

## Upstream quirks worth handling deliberately

These are source facts, not reasons to redesign the view:

- The footer advertises `[`/`]` for adjacent Runs, while the actual previous/next link buttons register `J`/`K`. Skyline currently uses `J`/`K`; choose one convention and make labels/actions agree. [Footer hint](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1875-L1887), [buttons](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L2035-L2077)
- `KeyboardShortcuts` accepts `setShowDurations` but does not destructure or use it; duration labels therefore have no footer action despite the state existing. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L1838-L1872)
- Queue-time semantics are inverted internally: when the switch is off, `queuedDuration` is passed and subtracted; when on, `undefined` is passed and original offsets remain. Preserve the visible behavior, not the variable naming. [Source](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam/route.tsx#L897-L999)
- `FollowCursor` treats an exact normalized `x = 0` as absent because it checks truthiness. A faithful copy can fix that zero-edge bug without changing normal appearance. [`FollowCursor`](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Timeline.tsx#L178-L205)
- Trigger persists panel snapshots in cookies and disables splitter collapse animation on Firefox using an SSR-derived browser flag. Skyline can retain its current client persistence/detection, but panel IDs, sizes, and collapse behavior should match. [Resizable implementation](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/Resizable.tsx#L14-L116), [cookie snapshot reader](https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/services/resizablePanel.server.ts#L1-L40)

## Recommended extraction boundary

Keep four layers explicit:

1. **Skyline route/controller:** load `TracePageDto`, poll while instructed, handle errors and navigation.
2. **Run-detail view-model adapter:** map Skyline units/statuses/kinds into the retained Trigger client contract.
3. **Vendored trace viewer:** page header, `TraceView`, `TasksTreeView`, `TimelineView`, TreeView state/reducer/utils, Timeline/Resizable/primitives, and exact visual components.
4. **Skyline inspector renderer:** use Trigger's inspector shell/timeline/primitives with Skyline's `InspectorDto` sections.

Do not copy `loader`, `RunPresenter`, `NextRunListPresenter`, `SpanPresenter`, model/session/RBAC/ClickHouse/Redis imports, Remix serialization, or Trigger path builders. Those are implementation of Trigger's data seam, and Skyline already owns an equivalent seam.

The current Skyline view has already reproduced many behaviors manually—polling, filters, queue-time adjustment, nested splits, synchronized scroll, selection, adjacent navigation, and keyboard handling—but it renders non-virtualized bespoke rows and bespoke inspector markup. [`TraceContent`](../../resources/js/trigger/TriggerInterface.tsx#L433-L725) Replacing that region with the pinned client composition, rather than incrementally styling the current imitation, is the shortest route to one-to-one fidelity.

## Fidelity checklist

- Same 40 px route header and accessory placement.
- Same 40 px trace-filter row and 52 px footer.
- Same 100/250/500 px outer panel constraints and 50/50 inner split.
- Same 32 px virtual rows and synchronized scroll.
- Same selection/collapse/filter semantics and URL persistence.
- Same queue-time origin behavior.
- Same five ticks, 1.05 duration range, 10× maximum zoom, bars, dots, partial tile, live duration, and hover timestamp.
- Same truncation callout and live/disabled indicator positions.
- Same inspector title, close animation, background, scroll behavior, tabs where applicable, and lifecycle/status primitives.
- Same root/parent and adjacent navigation affordances.
- Unsupported actions occupy no active UI but remain easy to restore.
- Visual fixtures cover completed, failed, active, queued, nested child Run, truncated trace, long labels, dense trace, and every Skyline inspector kind.
