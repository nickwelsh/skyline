export function expandedDialogCounts(baseline: number) {
  if (!Number.isInteger(baseline) || baseline < 0) throw new Error("Dialog baseline must be a non-negative integer.");
  return { open: baseline + 1, closed: baseline };
}

export function expectedExpandedDialogTranscript(application: "trigger" | "skyline") {
  void application;
  return {
    dialogCountBefore: 0,
    dialogCountAfterEscape: 0,
    expand: { connected: false, focused: false },
    presenterCount: 0,
    selectedAnchorCount: 1,
    active: {
      tag: "body",
      role: "",
      name: "",
    },
  };
}
