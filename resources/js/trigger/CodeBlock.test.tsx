import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./CodeBlock";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("CodeBlock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("keeps Trigger's titleless three-icon code viewer", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <CodeBlock label="Context" code={'{"runId":"run_1"}'} language="json" jsonValue={{ runId: "run_1" }} showLineNumbers={false} showTextWrapping />,
    ));

    const viewer = container.querySelector<HTMLElement>('[aria-label="Context"]')!;
    const wrap = viewer.querySelector<HTMLButtonElement>('button[aria-label="Wrap Context"]')!;
    const tree = viewer.querySelector<HTMLButtonElement>('button[aria-label="Show Context tree"]')!;
    const copy = viewer.querySelector<HTMLButtonElement>('button[aria-label="Copy Context"]')!;
    const expand = viewer.querySelector<HTMLButtonElement>('button[aria-label="Expand Context"]')!;

    expect(viewer.textContent).not.toContain("Context");
    expect([tree, wrap, copy, expand].every(Boolean)).toBe(true);
    expect([tree, wrap, copy, expand].every((button) => !button.className.includes("hover:bg-"))).toBe(true);
    const codeViewport = viewer.querySelector<HTMLElement>('div[dir="ltr"]')!;
    expect(codeViewport.className).toContain("px-2");
    expect(codeViewport.className).not.toContain("px-3");

    flushSync(() => wrap.click());
    expect(viewer.querySelector('button[aria-label="Unwrap Context"]')).not.toBeNull();

    flushSync(() => tree.click());
    expect(viewer.querySelector('[role="tree"][aria-label="Context JSON tree"]')).not.toBeNull();
    expect(viewer.querySelector('button[aria-label="Show Context code"]')).not.toBeNull();

    flushSync(() => expand.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Context");

    flushSync(() => root.unmount());
  });

  it("loads the pinned source Prism grammars", async () => {
    await vi.waitFor(() => {
      const prism = (globalThis as typeof globalThis & { Prism?: { languages?: Record<string, unknown> } }).Prism;
      expect(prism?.languages).toMatchObject({ json: expect.any(Object), typescript: expect.any(Object), sql: expect.any(Object) });
    });
  });

  it("rerenders JSON with the pinned Prism grammar after async setup", async () => {
    const prism = (globalThis as typeof globalThis & { Prism: { languages: Record<string, unknown> } }).Prism;
    await vi.waitFor(() => expect(prism.languages.json).toBeDefined());
    const jsonGrammar = prism.languages.json;
    delete prism.languages.json;
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <CodeBlock code={'{"message":"Invoice import delayed"}'} language="json" showOpenInModal={false} />,
    ));
    expect(container.querySelector(".token.property")).toBeNull();
    prism.languages.json = jsonGrammar;

    await vi.waitFor(() => {
      expect(container.querySelector(".token.property")?.textContent).toBe('"message"');
      expect(container.querySelector(".token.string")?.textContent).toBe('"Invoice import delayed"');
    });

    flushSync(() => root.unmount());
  });

  it("syntax-highlights PHP exception snippets", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <CodeBlock
        code={"public function handle(): void\n{\n    throw new RuntimeException('Payment failed.');\n}"}
        language="php"
        showOpenInModal={false}
      />,
    ));

    await vi.waitFor(() => {
      expect(container.querySelector(".token.keyword")?.textContent).toBe("public");
      expect(container.querySelector(".token.string")?.textContent).toBe("'Payment failed.'");
    });

    flushSync(() => root.unmount());
  });

  it("highlights the full overflowing throwing line with file-relative line numbers", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <CodeBlock
        code={"public function handle(): void\n{\n    throw new RuntimeException('Payment failed.');\n}"}
        language="php"
        highlightedRanges={[[3, 3]]}
        startingLine={26}
        label="application frame 1"
        showTextWrapping
      />,
    ));

    await vi.waitFor(() => expect(container.querySelector(".token.keyword")).not.toBeNull());
    const viewer = container.querySelector<HTMLElement>('[aria-label="application frame 1"]')!;
    const lines = viewer.querySelectorAll<HTMLElement>("pre > div");

    expect(lines[2].className).toContain("bg-rose-500/10");
    expect(lines[2].className).toContain("w-max");
    expect(lines[2].className).toContain("min-w-full");
    expect([...lines].every((line) => line.style.opacity === "")).toBe(true);
    expect([...lines].map((line) => line.firstElementChild?.textContent)).toEqual(["26", "27", "28", "29"]);

    flushSync(() => root.unmount());
  });

  it("keeps source default Code blocks unnamed", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(<CodeBlock code="const value = 1" showOpenInModal={false} />));

    const viewer = container.querySelector<HTMLElement>("[translate='no']")!;
    expect(viewer.getAttribute("aria-label")).toBeNull();
    expect(viewer.querySelector("button")?.getAttribute("aria-label")).toBeNull();

    flushSync(() => root.unmount());
  });

  it("keeps the source title element and typography", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(<CodeBlock code="Invoice import delayed" rowTitle="Message" label="Message" />));

    const title = container.querySelector("[translate='no'] > div:first-child > p");
    expect(title?.textContent).toBe("Message");
    expect(title?.className).toContain("font-medium");
    expect(container.querySelector<HTMLElement>('div[dir="ltr"]')?.className).not.toContain("pt-10");
    expect(container.querySelector('button[aria-label="Copy Message"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Expand Message"]')).not.toBeNull();

    flushSync(() => root.unmount());
  });

  it("closes its dialog on Escape while nested modal content is focused", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);
    const onParentKeyDown = vi.fn();

    flushSync(() => root.render(
      <div onKeyDown={onParentKeyDown}>
        <CodeBlock
          label="Properties"
          code="select * from users"
          showTextWrapping
          isolateModalEscape
          modalContent={<button type="button">Operation evidence</button>}
        />
      </div>,
    ));

    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn() } });
    const viewer = container.querySelector<HTMLElement>('[aria-label="Properties"]')!;
    flushSync(() => viewer.querySelector<HTMLButtonElement>('button[aria-label="Wrap Properties"]')!.click());
    flushSync(() => viewer.querySelector<HTMLButtonElement>('button[aria-label="Copy Properties"]')!.click());
    expect(document.body.textContent).toContain("Copied");
    flushSync(() => viewer.querySelector<HTMLButtonElement>('button[aria-label="Expand Properties"]')!.click());
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const evidence = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === "Operation evidence")!;
    evidence.focus();
    expect(document.activeElement).toBe(evidence);
    await new Promise((resolve) => window.setTimeout(resolve, 1_600));
    expect(document.body.textContent).not.toContain("Copied");
    onParentKeyDown.mockClear();
    flushSync(() => evidence.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onParentKeyDown).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.activeElement).toBe(viewer.querySelector('button[aria-label="Expand Properties"]')));

    flushSync(() => root.unmount());
  });
});
