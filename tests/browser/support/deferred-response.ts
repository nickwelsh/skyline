export function createFirstResponseGate() {
  let releasePromise!: () => void;
  let markHeld!: () => void;
  let held = false;
  let released = false;
  const pending = new Promise<void>((resolve) => { releasePromise = resolve; });
  const heldPromise = new Promise<void>((resolve) => { markHeld = resolve; });

  return {
    async hold(): Promise<void> {
      if (held) return;
      held = true;
      markHeld();
      await pending;
    },
    async waitUntilHeld(): Promise<void> {
      await heldPromise;
    },
    release(): void {
      if (released) return;
      released = true;
      releasePromise();
    },
  };
}

export type FirstResponseGate = ReturnType<typeof createFirstResponseGate>;
