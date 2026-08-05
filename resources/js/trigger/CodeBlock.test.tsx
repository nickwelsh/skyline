import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps Trigger's titleless three-icon code viewer", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <CodeBlock label="Context" code={'{"runId":"run_1"}'} language="json" showLineNumbers={false} showTextWrapping />,
    ));

    const viewer = container.querySelector<HTMLElement>('[aria-label="Context"]')!;
    const wrap = viewer.querySelector<HTMLButtonElement>('button[aria-label="Wrap Context"]')!;
    const copy = viewer.querySelector<HTMLButtonElement>('button[aria-label="Copy Context"]')!;
    const expand = viewer.querySelector<HTMLButtonElement>('button[aria-label="Expand Context"]')!;

    expect(viewer.textContent).not.toContain("Context");
    expect([wrap, copy, expand].every(Boolean)).toBe(true);
    expect([wrap, copy, expand].every((button) => !button.className.includes("hover:bg-"))).toBe(true);

    flushSync(() => wrap.click());
    expect(viewer.querySelector('button[aria-label="Unwrap Context"]')).not.toBeNull();

    flushSync(() => expand.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Context");

    flushSync(() => root.unmount());
  });
});
