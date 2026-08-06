export function expandedDialogCounts(baseline: number) {
  if (!Number.isInteger(baseline) || baseline < 0) throw new Error("Dialog baseline must be a non-negative integer.");
  return { open: baseline + 1, closed: baseline };
}
