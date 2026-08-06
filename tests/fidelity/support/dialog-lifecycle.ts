export function expandedDialogCounts(baseline: number) {
  if (!Number.isInteger(baseline) || baseline < 0) throw new Error("Dialog baseline must be a non-negative integer.");
  return { open: baseline + 1, closed: baseline };
}

export function expectedExpandedDialogTranscript(application: "trigger" | "skyline") {
  return {
    dialogCountBefore: 0,
    dialogCountAfterEscape: 0,
    expand: { connected: true, focused: true },
    presenterCount: 1,
    selectedAnchorCount: 1,
    active: {
      tag: "button",
      role: "",
      name: application === "skyline" ? "Expand Properties" : "",
    },
  };
}
