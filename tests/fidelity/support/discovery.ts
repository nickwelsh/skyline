export type DiscoveryStep = <T>(label: string, action: () => Promise<T>) => Promise<T>;

export function createDiscoveryStep(
  capture: string,
  options: { timeoutMs?: number; write?: (line: string) => unknown } = {},
): DiscoveryStep {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const write = options.write ?? ((line: string) => process.stdout.write(line));

  return async <T>(label: string, action: () => Promise<T>) => {
    const started = Date.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let status: "passed" | "failed" = "passed";
    try {
      return await Promise.race([
        action(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`NW224 discovery phase ${label} exceeded ${timeoutMs}ms for ${capture}.`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      status = "failed";
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      write(`\nNW224_DISCOVERY_STEP=${JSON.stringify({ capture, label, status, elapsedMs: Date.now() - started })}\n`);
    }
  };
}
