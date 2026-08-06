type ClosablePage = { close(options: { runBeforeUnload: false }): Promise<unknown> };
type ClosableContext = { close(): Promise<unknown> };
type LabeledPage = { label: string; page: ClosablePage };

export async function closeContextAfterPages(
  context: ClosableContext,
  pages: readonly LabeledPage[],
  options: { capture: string; timeoutMs?: number },
) {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const pageCount = `${pages.length} ${pages.length === 1 ? "page" : "pages"}`;
  await Promise.all(pages.map(({ label, page }) => bounded(
    `Browser teardown page ${label} for ${options.capture} with ${pageCount} exceeded ${timeoutMs}ms.`,
    () => page.close({ runBeforeUnload: false }),
    timeoutMs,
  )));
  await bounded(
    `Browser teardown context for ${options.capture} with ${pageCount} exceeded ${timeoutMs}ms.`,
    () => context.close(),
    timeoutMs,
  );
}

async function bounded<T>(message: string, action: () => Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
