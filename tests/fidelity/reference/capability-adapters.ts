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
    .replace(params, `${params}\n  const showErrorVersions = !additionalTableState?.errorId || errorRunTableCapabilityPolicy.detailVersions;`)
    .replace(header, "          {showErrorVersions ? <TableHeaderCell>Version</TableHeaderCell> : null}")
    .replace(cell, "                {showErrorVersions ? <TableCell to={path}>{run.version ?? \"–\"}</TableCell> : null}");
  return `${adapted}\nconst errorRunTableCapabilityPolicy = ${JSON.stringify(policy)};\n`;
}
