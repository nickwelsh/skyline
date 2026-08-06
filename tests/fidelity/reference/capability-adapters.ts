type ErrorCapabilityPolicy = {
  hiddenMutableRegions?: string[];
  detailVersions?: boolean;
  detailBulkReplay?: boolean;
};

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

  const bulkStart = adapted.indexOf("                  <PermissionLink\n                    hasPermission={canReplayRuns}");
  const bulkEnd = adapted.indexOf("                  </PermissionLink>", bulkStart);
  if (bulkStart < 0 || bulkEnd < 0) throw new Error("Pinned Trigger Error detail bulk replay changed; capability adapter must be reviewed.");
  const bulk = adapted.slice(bulkStart, bulkEnd + "                  </PermissionLink>".length);
  adapted = adapted.slice(0, bulkStart)
    + `                  {errorCapabilityPolicy.detailBulkReplay ? (\n${bulk}\n                  ) : null}`
    + adapted.slice(bulkEnd + "                  </PermissionLink>".length);

  return `${adapted}\nconst errorCapabilityPolicy = ${JSON.stringify(policy)};\n`;
}

export function conditionErrorRunTableCapabilities(code: string, policy: Pick<ErrorCapabilityPolicy, "detailVersions">) {
  const params = "  const params = new URLSearchParams(location.search || \"\");";
  const header = "          <TableHeaderCell>Version</TableHeaderCell>";
  const cell = "                <TableCell to={path}>{run.version ?? \"–\"}</TableCell>";
  if (!code.includes(params) || !code.includes(header) || !code.includes(cell)) {
    throw new Error("Pinned Trigger Error Runs Version column changed; capability adapter must be reviewed.");
  }
  const adapted = code
    .replace(params, `${params}\n  const showErrorVersions = !additionalTableState?.errorId || errorRunTableCapabilityPolicy.detailVersions;\n  const showErrorTaskKind = !additionalTableState?.errorId;`)
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
    );
  if (!adapted.includes("showErrorTaskKind ? (")) {
    throw new Error("Pinned Trigger Error Runs task-kind icon changed; capability adapter must be reviewed.");
  }
  return `${adapted}\nconst errorRunTableCapabilityPolicy = ${JSON.stringify(policy)};\n`;
}

function replaceMarker(code: string, source: string, replacement: string, label: string) {
  if (!code.includes(source)) throw new Error(`Pinned Trigger Queue ${label} changed; capability adapter must be reviewed.`);
  return code.replace(source, replacement);
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
  let adapted = replaceMarker(code, '              title="Running"\n              value={envRunningLive}', '              title="Running"\n              capabilityMarker="queue-root-running"\n              value={envRunningLive}', "Running stat");
  adapted = replaceMarker(adapted, '              title="Environment limit"\n              value={envLimit}', '              title="Environment limit"\n              capabilityMarker="queue-root-environment-limit"\n              value={envLimit}', "Environment limit stat");
  adapted = replaceMarker(adapted, 'button={<ExclamationTriangleIcon className="size-4 text-warning" />}', 'button={<ExclamationTriangleIcon data-trigger-capability={`queue-target-${queue.id}-warning`} className="size-4 text-warning" />}', "warning adornment");
  adapted = replaceMarker(adapted, '                            queue.concurrency?.overriddenAt && "font-medium text-text-bright"', '                            queue.concurrency?.overriddenAt && "font-medium text-text-bright"\n                          )}\n                          capabilityMarker={`queue-target-${queue.id}-limit`}\n                        >\n                          {queue.concurrencyLimitOverridePercent !== null ? (\n                            <>\n                              {limit}\n                              <span className="ml-1 text-text-dimmed group-hover/table-row:text-text-bright">\n                                ({formatOverridePercent(queue.concurrencyLimitOverridePercent)}%)\n                              </span>\n                            </>\n                          ) : (\n                            limit\n                          )}\n                        </TableCell>\n                        <TableCell\n                          to={queueDetailPath}\n                          alignment="right"\n                          actionClassName="pl-16"\n                          className={cn("w-[1%]", queue.paused ? "opacity-50" : undefined)}', "Limit and Limited by cells");
  adapted = replaceMarker(adapted, '                          // Keep the whole row navigable:', '                          capabilityMarker={`queue-target-${queue.id}-limited-by`}\n                          // Keep the whole row navigable:', "Limited by marker");
  adapted = replaceMarker(adapted, '                            paused={queue.paused}', '                            capabilityMarker={isAtConcurrencyLimit && queue.queued > 0 ? `queue-target-${queue.id}-health` : undefined}\n                            paused={queue.paused}', "health marker");
  adapted = replaceMarker(adapted, '                            data={queueMetric?.depthSparkline}', '                            capabilityMarker={`queue-target-${queue.id}-backlog`}\n                            data={queueMetric?.depthSparkline}', "backlog marker");
  return replaceMarker(adapted, '                        <TableCellMenu\n                          isSticky', '                        <TableCellMenu\n                          capabilityMarker={`queue-target-${queue.id}-pause-resume`}\n                          isSticky', "pause marker");
}

export function conditionQueueDetailMarkers(code: string) {
  let adapted = replaceMarker(code, '          title="Concurrency"', '          title="Concurrency"\n          capabilityMarker="queue-detail-concurrency-limit"', "Concurrency chart");
  adapted = replaceMarker(adapted, '          title="Throttled"', '          title="Throttled"\n          capabilityMarker="queue-detail-throttled"', "Throttled chart");
  return replaceMarker(adapted, '          <div className="flex flex-wrap items-baseline gap-2">', '          <div data-trigger-capability="queue-detail-concurrency" className="flex flex-wrap items-baseline gap-2">', "detail concurrency");
}
