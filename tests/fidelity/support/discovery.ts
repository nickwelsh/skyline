export type DiscoveryStep = <T>(label: string, action: () => Promise<T>) => Promise<T>;

export function createDiscoveryStep(
  capture: string,
  options: { marker?: "NW223" | "NW224"; timeoutMs?: number; write?: (line: string) => unknown } = {},
): DiscoveryStep {
  const marker = options.marker ?? "NW224";
  const timeoutMs = options.timeoutMs ?? 10_000;
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
            () => reject(new Error(`${marker} discovery phase ${label} exceeded ${timeoutMs}ms for ${capture}.`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      status = "failed";
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      write(`\n${marker}_DISCOVERY_STEP=${JSON.stringify({ capture, label, status, elapsedMs: Date.now() - started })}\n`);
    }
  };
}
