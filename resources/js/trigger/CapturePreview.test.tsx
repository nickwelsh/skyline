import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { HtmlCapturePreview } from "./CapturePreview";

describe("HtmlCapturePreview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders captured mail HTML by default and keeps its source available", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);
    const html = '<main><h1 style="color: red">Receipt</h1></main>';

    flushSync(() => root.render(<HtmlCapturePreview label="HTML body" value={html} />));

    const render = container.querySelector<HTMLButtonElement>('button[aria-selected="true"]')!;
    const frame = container.querySelector<HTMLIFrameElement>('iframe[title="HTML body rendered preview"]')!;

    expect(render.textContent).toBe("Render");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.srcdoc).toContain("default-src 'none'");
    expect(frame.srcdoc).toContain(html);

    const source = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Source")!;
    flushSync(() => source.click());

    expect(source.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("Receipt");

    flushSync(() => root.unmount());
  });
});
