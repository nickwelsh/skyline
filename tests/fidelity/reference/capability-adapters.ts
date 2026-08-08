type ErrorCapabilityPolicy = {
  hiddenMutableRegions?: string[];
  detailVersions?: boolean;
  detailMachines?: boolean;
  detailPlatformColumns?: boolean;
  detailPagination?: boolean;
  detailBulkReplay?: boolean;
};

export function conditionReferencePathName(code: string) {
  const locationReturn = "return location.pathname;";
  const navigationReturn = "return navigation.location.pathname;";
  if (!code.includes(locationReturn) || !code.includes(navigationReturn)) {
    throw new Error("Pinned Trigger reference pathname hook changed; capability adapter must be reviewed.");
  }

  return code
    .replace(
      locationReturn,
      "return (window as any).__TRIGGER_FIDELITY_REFERENCE__?.sourcePathName?.(location.pathname) ?? location.pathname;",
    )
    .replace(
      navigationReturn,
      "return (window as any).__TRIGGER_FIDELITY_REFERENCE__?.sourcePathName?.(navigation.location.pathname) ?? navigation.location.pathname;",
    );
}

export function conditionRunsRouteCapabilities(code: string) {
  const filters = "                  <RunsFilters\n                    possibleTasks={list.possibleTasks}";
  const selection = "                  allowSelection\n";
  const group = '    <ResizablePanelGroup orientation="horizontal" className="max-h-full">\n';
  const panel = '      <ResizablePanel id="runs-main" min={"100px"}>\n';
  const handle = '      <ResizableHandle\n        id="runs-handle"';
  const groupEnd = "    </ResizablePanelGroup>";
  const title = '<PageTitle title="Runs" accessory={<RunsHelpTooltip />} />';
  if (![filters, selection, group, panel, handle, groupEnd, title].every((marker) => code.includes(marker))) {
    throw new Error("Pinned Trigger Runs route capability seam changed; capability adapter must be reviewed.");
  }

  let adapted = code
    .replace(filters, "                  <RunsFilters\n                    hideSearch\n                    possibleTasks={list.possibleTasks}")
    .replace(title, '<PageTitle title="Runs" />')
    .replace(selection, "")
    .replace(group, "")
    .replace(panel, "");
  const handleStart = adapted.indexOf(handle);
  const groupEndIndex = adapted.indexOf(groupEnd, handleStart);
  const mainPanelEnd = adapted.lastIndexOf("      </ResizablePanel>\n", handleStart);
  if (handleStart < 0 || groupEndIndex < 0 || mainPanelEnd < 0) {
    throw new Error("Pinned Trigger Runs resizable seam changed; capability adapter must be reviewed.");
  }
  adapted = adapted.slice(0, mainPanelEnd)
    + adapted.slice(mainPanelEnd + "      </ResizablePanel>\n".length, handleStart)
    + adapted.slice(groupEndIndex + groupEnd.length);
  return adapted;
}

export function conditionRunsFilterCapabilities(code: string) {
  const filtersStart = "const filterTypes = [";
  const filtersEnd = "] as const;";
  const start = code.indexOf(filtersStart);
  const end = code.indexOf(filtersEnd, start);
  const taskLabel = "                    <span>Tasks</span>";
  const appliedTaskLabel = '                    label="Task"';
  const aiImport = 'import { AIFilterInput } from "./AIFilterInput";';
  const aiControl = "      {!props.hideSearch && <AIFilterInput />}";
  if (start < 0 || end < 0 || !code.includes(taskLabel) || !code.includes(appliedTaskLabel) || !code.includes(aiImport) || !code.includes(aiControl)) {
    throw new Error("Pinned Trigger Runs filter capability seam changed; capability adapter must be reviewed.");
  }
  const adapted = code.slice(0, start)
    + 'const filterTypes = [\n  { name: "queues", title: "Queues", icon: <RectangleStackIcon className="size-4" /> },\n] as const;'
    + code.slice(end + filtersEnd.length);
  return adapted
    .replace(aiImport, 'import { SearchInput } from "~/components/primitives/SearchInput";')
    .replace(aiControl, '      <SearchInput placeholder="Search Runs" />')
    .replace(taskLabel, "                    <span>Jobs</span>")
    .replace(appliedTaskLabel, '                    label="Job"');
}

export function conditionRunsTableCapabilities(code: string) {
  const declaration = "export function TaskRunsTable({";
  if (!code.includes(declaration) || !code.includes("type RunsTableProps = {") || !code.includes("<RunActionsCell")) {
    throw new Error("Pinned Trigger Runs table capability seam changed; capability adapter must be reviewed.");
  }
  const adapted = code.replace(declaration, "function SourceTaskRunsTable({");
  return `${adapted}
export function TaskRunsTable(props: RunsTableProps) {
  if (props.additionalTableState?.errorId) return <SourceTaskRunsTable {...props} />;
  return <CapabilityRunsTable {...props} />;
}

function CapabilityRunsTable({ total, hasFilters, runs, isLoading = false, variant = "dimmed", showTopBorder = true, stickyHeader = false, additionalTableState, rootOnlyDefault }: RunsTableProps) {
  const organization = useOrganization();
  const project = useProject();
  const params = new URLSearchParams();
  if (additionalTableState) for (const [key, value] of Object.entries(additionalTableState)) params.set(key, value);
  if (rootOnlyDefault !== undefined) params.set("rootOnly", String(rootOnlyDefault));
  const tableState = params.toString();
  return (
    <Table variant={variant} className="max-h-full overflow-y-auto" showTopBorder={showTopBorder} stickyHeader={stickyHeader}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell disableTooltipHoverableContent tooltip={<div className="flex flex-col divide-y divide-grid-dimmed">{filterableTaskRunStatuses.map((status) => <div key={status} className="grid grid-cols-[8rem_1fr] gap-x-2 py-2 first:pt-1 last:pb-1"><div className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap"><TaskRunStatusCombo status={status} /></div><Paragraph variant="extra-small" className="text-wrap! text-text-dimmed">{descriptionForTaskRunStatus(status)}</Paragraph></div>)}</div>}>Status</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell colSpan={3}>Duration</TableHeaderCell>
          <TableHeaderCell>Queue target</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {total === 0 ? <TableBlankRow colSpan={8}>{!isLoading && <Paragraph className="w-auto">{hasFilters ? "No runs match your filters." : "No runs found"}</Paragraph>}</TableBlankRow> : runs.map((run) => {
          const search = new URLSearchParams();
          if (tableState) search.set("tableState", encodeURIComponent(tableState));
          const path = v3RunSpanPath(organization, project, run.environment, run, { spanId: run.spanId }, search);
          return <TableRow key={run.id}>
            <TableCell to={path} isTabbableCell><TruncatedCopyableValue value={run.friendlyId} /></TableCell>
            <TableCell to={path}><span className="flex items-center gap-x-1">{run.taskIdentifier}{run.rootTaskRunId === null ? <Badge variant="extra-small">Root</Badge> : null}</span></TableCell>
            <TableCell to={path}><SimpleTooltip content={descriptionForTaskRunStatus(run.status)} disableHoverableContent button={<TaskRunStatusCombo status={run.status} />} /></TableCell>
            <TableCell to={path}>{run.startedAt ? <DateTime date={run.startedAt} /> : "–"}</TableCell>
            <TableCell to={path} className="w-[1%]" actionClassName="pr-0 tabular-nums"><div className="flex items-center gap-1"><RectangleStackIcon className="size-4 text-text-dimmed" />{run.queueDuration}</div></TableCell>
            <TableCell to={path} className="w-[1%]" actionClassName="px-4 tabular-nums"><div className="flex items-center gap-1"><ClockIcon className="size-4 text-blue-500" />{run.duration}</div></TableCell>
            <TableCell to={path} actionClassName="pl-0 tabular-nums"><div className="flex items-center gap-1"><CpuChipIcon className="size-4 text-success" />{run.activeDuration}</div></TableCell>
            <TableCell to={path}>{run.queueTarget}</TableCell>
          </TableRow>;
        })}
        {isLoading && <TableBlankRow colSpan={8} className="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-2 bg-background-dimmed"><Spinner /> <span className="text-text-dimmed">Loading…</span></TableBlankRow>}
      </TableBody>
    </Table>
  );
}
`;
}

export function conditionErrorDetailCapabilities(code: string, policy: ErrorCapabilityPolicy) {
  let adapted = code;
  if (policy.hiddenMutableRegions?.includes("detail-status")) {
    const start = adapted.indexOf("            {/* Status */}");
    const end = adapted.indexOf("            {/* Error message */}", start);
    if (start < 0 || end < 0) throw new Error("Pinned Trigger Error detail status changed; capability adapter must be reviewed.");
    adapted = adapted.slice(0, start) + adapted.slice(end);
  }

  const versions = "              <LogsVersionFilter />";
  if (!adapted.includes(versions)) throw new Error("Pinned Trigger Error detail Versions filter changed; capability adapter must be reviewed.");
  adapted = adapted.replace(versions, "              {errorCapabilityPolicy.detailVersions ? <LogsVersionFilter /> : null}");

  const affectedVersions = "            {errorGroup.affectedVersions.length > 0 && (";
  if (!adapted.includes(affectedVersions)) throw new Error("Pinned Trigger Error detail affected Versions changed; capability adapter must be reviewed.");
  adapted = adapted.replace(affectedVersions, "            {errorCapabilityPolicy.detailVersions && errorGroup.affectedVersions.length > 0 && (");

  const pagination = "                  <ListPagination list={runList} />";
  if (!adapted.includes(pagination)) throw new Error("Pinned Trigger Error detail pagination changed; capability adapter must be reviewed.");
  adapted = adapted.replace(pagination, "                  {errorCapabilityPolicy.detailPagination ? <ListPagination list={runList} /> : null}");

  const bulkStart = adapted.indexOf("                  <PermissionLink\n                    hasPermission={canReplayRuns}");
  const bulkEnd = adapted.indexOf("                  </PermissionLink>", bulkStart);
  if (bulkStart < 0 || bulkEnd < 0) throw new Error("Pinned Trigger Error detail bulk replay changed; capability adapter must be reviewed.");
  const bulk = adapted.slice(bulkStart, bulkEnd + "                  </PermissionLink>".length);
  adapted = adapted.slice(0, bulkStart)
    + `                  {errorCapabilityPolicy.detailBulkReplay ? (\n${bulk}\n                  ) : null}`
    + adapted.slice(bulkEnd + "                  </PermissionLink>".length);

  return `${adapted}\nconst errorCapabilityPolicy = ${JSON.stringify(policy)};\n`;
}

export function conditionErrorRunTableCapabilities(code: string, policy: Pick<ErrorCapabilityPolicy, "detailVersions" | "detailMachines" | "detailPlatformColumns">) {
  const params = "  const params = new URLSearchParams(location.search || \"\");";
  const header = "          <TableHeaderCell>Version</TableHeaderCell>";
  const cell = "                <TableCell to={path}>{run.version ?? \"–\"}</TableCell>";
  if (!code.includes(params) || !code.includes(header) || !code.includes(cell)) {
    throw new Error("Pinned Trigger Error Runs Version column changed; capability adapter must be reviewed.");
  }
  let adapted = code
    .replace(params, `${params}\n  const isErrorRunTable = Boolean(additionalTableState?.errorId);\n  const showErrorVersions = !isErrorRunTable || errorRunTableCapabilityPolicy.detailVersions;\n  const showErrorMachines = !isErrorRunTable || errorRunTableCapabilityPolicy.detailMachines;\n  const showErrorPlatformColumns = !isErrorRunTable || errorRunTableCapabilityPolicy.detailPlatformColumns;\n  const showErrorTaskKind = !isErrorRunTable;`)
    .replace(header, "          {showErrorVersions ? <TableHeaderCell>Version</TableHeaderCell> : null}")
    .replace(cell, "                {showErrorVersions ? <TableCell to={path}>{run.version ?? \"–\"}</TableCell> : null}")
    .replace(
      `                    <TaskTriggerSourceIcon
                      source={run.taskKind as TaskTriggerSource}
                      className="size-3.5 flex-none"
                    />`,
      `                    {showErrorTaskKind ? (
                      <TaskTriggerSourceIcon
                        source={run.taskKind as TaskTriggerSource}
                        className="size-3.5 flex-none"
                      />
                    ) : null}`,
    )
    .replaceAll("{showCompute && (", "{showCompute && showErrorPlatformColumns && (")
    .replaceAll("{showRegion && <TableHeaderCell>Region</TableHeaderCell>}", "{showRegion && showErrorPlatformColumns ? <TableHeaderCell>Region</TableHeaderCell> : null}")
    .replaceAll("{showRegion && (", "{showRegion && showErrorPlatformColumns && (");

  adapted = wrapErrorRange(
    adapted,
    '          <TableHeaderCell className="pl-4" tooltip={<MachineTooltipInfo />}>',
    "          <TableHeaderCell>Queue</TableHeaderCell>",
    "          {showErrorMachines ? (\n",
    "          ) : null}\n",
    "Runs Machine header",
  );
  adapted = wrapErrorRange(
    adapted,
    "          <TableHeaderCell>Test</TableHeaderCell>",
    "        </TableRow>",
    "          {showErrorPlatformColumns ? (<>\n",
    "          </>) : null}\n",
    "Runs platform headers",
  );
  adapted = wrapErrorRange(
    adapted,
    "                <TableCell to={path}>\n                  <MachineLabelCombo preset={run.machinePreset} />",
    "                <TableCell to={path}>\n                  {run.queue.type === \"task\" ? (",
    "                {showErrorMachines ? (\n",
    "                ) : null}\n",
    "Runs Machine cell",
  );
  adapted = wrapErrorRange(
    adapted,
    "                <TableCell to={path}>\n                  {run.isTest ? (",
    "              </TableRow>",
    "                {showErrorPlatformColumns ? (<>\n",
    "                </>) : null}\n",
    "Runs platform cells",
  );

  const showRegion = '  const showRegion = environment.type !== "DEVELOPMENT";';
  if (!adapted.includes(showRegion)) throw new Error("Pinned Trigger Error Runs column count changed; capability adapter must be reviewed.");
  adapted = adapted.replace(showRegion, `${showRegion}\n  const visibleColumnCount = isErrorRunTable\n    ? 8 + Number(showErrorVersions) + Number(showErrorMachines)\n    : showRegion ? 16 : 15;`);
  adapted = adapted.replaceAll("colSpan={showRegion ? 16 : 15}", "colSpan={visibleColumnCount}");
  adapted = adapted.replace(
    '<BlankState isLoading={isLoading} filters={filters} showRegion={showRegion} />',
    '<BlankState isLoading={isLoading} filters={filters} showRegion={showRegion} visibleColumnCount={visibleColumnCount} />',
  );
  adapted = adapted.replace(
    '}: Pick<RunsTableProps, "isLoading" | "filters"> & { showRegion: boolean }) {',
    '  visibleColumnCount,\n}: Pick<RunsTableProps, "isLoading" | "filters"> & { showRegion: boolean; visibleColumnCount?: number }) {',
  );
  adapted = adapted.replace("  const colSpan = showRegion ? 16 : 15;", "  const colSpan = visibleColumnCount ?? (showRegion ? 16 : 15);");
  if (!adapted.includes("showErrorTaskKind ? (")) {
    throw new Error("Pinned Trigger Error Runs task-kind icon changed; capability adapter must be reviewed.");
  }
  if (!adapted.includes("showErrorMachines ? (") || !adapted.includes("showErrorPlatformColumns ? (")) {
    throw new Error("Pinned Trigger Error Runs supported column subset changed; capability adapter must be reviewed.");
  }
  return `${adapted}\nconst errorRunTableCapabilityPolicy = ${JSON.stringify(policy)};\n`;
}

function wrapErrorRange(code: string, startMarker: string, endMarker: string, opening: string, closing: string, label: string) {
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Pinned Trigger Error ${label} changed; capability adapter must be reviewed.`);
  return code.slice(0, start) + opening + code.slice(start, end) + closing + code.slice(end);
}

export function conditionJobSegmentedControlMarker(code: string) {
  return replaceMarker(
    code,
    '    <div\n      className={cn(',
    '    <div\n      data-trigger-capability={name === "task-type" ? "jobs-list-task-type-filter" : undefined}\n      className={cn(',
    "Task type filter marker",
  );
}

export function conditionJobDetailMarkers(code: string) {
  let adapted = code;
  adapted = wrapRange(
    adapted,
    '          <Property.Item>\n            <Property.Label>File path</Property.Label>',
    '          {task.queue ? (',
    '          <div data-trigger-capability="job-detail-source-definition" className="flex flex-col gap-y-3">\n',
    '          </div>\n',
    "source-definition group",
  );
  adapted = replaceMarker(
    adapted,
    '                  <Paragraph variant="extra-small" className="text-text-dimmed">',
    '                  <Paragraph data-trigger-capability="job-detail-queue-administration" variant="extra-small" className="text-text-dimmed">',
    "Queue administration marker",
  );
  return wrapRange(
    adapted,
    '          <Property.Item>\n            <Property.Label>Machine</Property.Label>',
    '          <Property.Item>\n            <Property.Label>Created</Property.Label>',
    '          <div data-trigger-capability="job-detail-runtime-policy" className="flex flex-col gap-y-3">\n',
    '          </div>\n',
    "runtime-policy group",
  );
}

function replaceMarker(code: string, source: string, replacement: string, label: string) {
  if (!code.includes(source)) throw new Error(`Pinned Trigger Queue ${label} changed; capability adapter must be reviewed.`);
  return code.replace(source, replacement);
}

function wrapRange(code: string, startMarker: string, endMarker: string, opening: string, closing: string, label: string) {
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Pinned Trigger Job ${label} changed; capability adapter must be reviewed.`);
  return code.slice(0, start) + opening + code.slice(start, end) + closing + code.slice(end);
}

export function conditionQueueBigNumberMarkers(code: string) {
  let adapted = replaceMarker(code, "  compactThreshold?: number;", "  compactThreshold?: number;\n  capabilityMarker?: string;", "BigNumber props");
  adapted = replaceMarker(adapted, "  compactThreshold,\n}: BigNumberProps)", "  compactThreshold,\n  capabilityMarker,\n}: BigNumberProps)", "BigNumber declaration");
  return replaceMarker(adapted, "      <div\n        className={cn(", "      <div\n        data-trigger-capability={capabilityMarker}\n        className={cn(", "BigNumber value");
}

export function conditionQueueTableMarkers(code: string) {
  let adapted = replaceMarker(code, "type TableCellProps = TableCellBasicProps & {", "type TableCellProps = TableCellBasicProps & {\n  capabilityMarker?: string;", "Table cell props");
  adapted = replaceMarker(adapted, "      className,\n      actionClassName,", "      className,\n      capabilityMarker,\n      actionClassName,", "Table cell declaration");
  adapted = replaceMarker(adapted, "      <td\n        ref={ref}", "      <td\n        ref={ref}\n        data-trigger-capability={capabilityMarker}", "Table cell element");
  adapted = replaceMarker(adapted, "      className,\n      isSticky,\n      onClick,\n      visibleButtons,", "      className,\n      capabilityMarker,\n      isSticky,\n      onClick,\n      visibleButtons,", "Table menu declaration");
  return replaceMarker(adapted, "      <TableCell\n        className={className}\n        isSticky={isSticky}\n        onClick={onClick}\n        ref={ref}\n        alignment=\"right\"\n        hasAction={true}", "      <TableCell\n        className={className}\n        capabilityMarker={capabilityMarker}\n        isSticky={isSticky}\n        onClick={onClick}\n        ref={ref}\n        alignment=\"right\"\n        hasAction={true}", "Table menu cell");
}

export function conditionQueueMiniChartMarkers(code: string) {
  let adapted = replaceMarker(code, "  showPeak?: boolean;", "  showPeak?: boolean;\n  capabilityMarker?: string;", "mini chart props");
  adapted = replaceMarker(adapted, "  showPeak = true,\n}: MiniLineChartProps)", "  showPeak = true,\n  capabilityMarker,\n}: MiniLineChartProps)", "mini chart declaration");
  adapted = replaceMarker(adapted, '<span className="text-text-dimmed">–</span>', '<span data-trigger-capability={capabilityMarker} className="text-text-dimmed">–</span>', "mini chart empty value");
  return replaceMarker(adapted, "    <div className={`flex items-start gap-1.5${fillWidth ? \" w-full\" : \"\"}`}>", "    <div data-trigger-capability={capabilityMarker} className={`flex items-start gap-1.5${fillWidth ? \" w-full\" : \"\"}`}>", "mini chart value");
}

export function conditionQueueMetricCardMarkers(code: string) {
  let adapted = replaceMarker(code, "  sampleCountColumn?: string;", "  sampleCountColumn?: string;\n  capabilityMarker?: string;", "metric props");
  adapted = replaceMarker(adapted, "  sampleCountColumn,\n}: QueueMetricChartProps)", "  sampleCountColumn,\n  capabilityMarker,\n}: QueueMetricChartProps)", "metric declaration");
  adapted = replaceMarker(adapted, "    <Chart.Root\n      config={chartConfig}", "    <div data-trigger-capability={capabilityMarker} className=\"h-full\">\n    <Chart.Root\n      config={chartConfig}", "metric chart");
  return replaceMarker(adapted, "    </Chart.Root>\n  );", "    </Chart.Root>\n    </div>\n  );", "metric chart end");
}

export function conditionQueueListMarkers(code: string) {
  let adapted = replaceMarker(
    code,
    'export function QueueFilters() {\n  return <SearchInput placeholder="Search queues…" paramName="query" resetParams={["page"]} />;\n}',
    'export function QueueFilters() {\n  return (\n    <div data-trigger-anchor="queue-filter-controls" role="search" aria-label="Queue search">\n      <SearchInput placeholder="Search queues…" paramName="query" resetParams={["page"]} />\n    </div>\n  );\n}',
    "filter anchor",
  );
  adapted = replaceMarker(adapted, '              title="Running"\n              value={envRunningLive}', '              title="Running"\n              capabilityMarker="queue-root-running"\n              value={envRunningLive}', "Running stat");
  adapted = replaceMarker(adapted, '              title="Environment limit"\n              value={envLimit}', '              title="Environment limit"\n              capabilityMarker="queue-root-environment-limit"\n              value={envLimit}', "Environment limit stat");
  adapted = replaceMarker(adapted, 'button={<ExclamationTriangleIcon className="size-4 text-warning" />}', 'button={<ExclamationTriangleIcon data-trigger-capability={`queue-target-${queue.id}-warning`} className="size-4 text-warning" />}', "warning adornment");
  adapted = replaceMarker(adapted, '                            queue.concurrency?.overriddenAt && "font-medium text-text-bright"\n                          )}\n                        >', '                            queue.concurrency?.overriddenAt && "font-medium text-text-bright"\n                          )}\n                          capabilityMarker={`queue-target-${queue.id}-limit`}\n                        >', "Limit marker");
  adapted = replaceMarker(adapted, '                          // Keep the whole row navigable:', '                          capabilityMarker={`queue-target-${queue.id}-limited-by`}\n                          // Keep the whole row navigable:', "Limited by marker");
  adapted = replaceMarker(adapted, '                            paused={queue.paused}', '                            capabilityMarker={isAtConcurrencyLimit && queue.queued > 0 ? `queue-target-${queue.id}-health` : undefined}\n                            paused={queue.paused}', "health marker");
  adapted = replaceMarker(adapted, "function QueueHealthBadge(health: QueueHealth) {", "function QueueHealthBadge(health: QueueHealth & { capabilityMarker?: string }) {", "health marker props");
  adapted = replaceMarker(adapted, "    <span\n      className={cn(\n        \"contrast-chip", "    <span\n      data-trigger-capability={health.capabilityMarker}\n      className={cn(\n        \"contrast-chip", "health marker element");
  adapted = replaceMarker(adapted, '                            data={queueMetric?.depthSparkline}', '                            capabilityMarker={`queue-target-${queue.id}-backlog`}\n                            data={queueMetric?.depthSparkline}', "backlog marker");
  return replaceMarker(adapted, '                        <TableCellMenu\n                          isSticky', '                        <TableCellMenu\n                          capabilityMarker={`queue-target-${queue.id}-pause-resume`}\n                          isSticky', "pause marker");
}

export function conditionQueueDetailMarkers(code: string) {
  let adapted = replaceMarker(code, '          title="Concurrency"', '          title="Concurrency"\n          capabilityMarker="queue-detail-concurrency-limit"', "Concurrency chart");
  adapted = replaceMarker(adapted, '          title="Throttled"', '          title="Throttled"\n          capabilityMarker="queue-detail-throttled"', "Throttled chart");
  return replaceMarker(adapted, '          <div className="flex flex-wrap items-baseline gap-2">', '          <div data-trigger-capability="queue-detail-concurrency" className="flex flex-wrap items-baseline gap-2">', "detail concurrency");
}

export function conditionQueueTimeFilterAnchor(code: string) {
  const adapted = replaceMarker(
    code,
    "                  <Ariakit.Select\n                    ref={triggerRef}",
    "                  <Ariakit.Select\n                    aria-label={`${constrained.label}: ${constrained.valueLabel}`}\n                    ref={triggerRef}",
    "Period filter accessible name",
  );
  return replaceMarker(
    adapted,
    '<div className="group cursor-pointer focus-custom" />',
    '<div data-trigger-anchor="queue-period-filter" className="group cursor-pointer focus-custom" />',
    "Period filter anchor",
  );
}
