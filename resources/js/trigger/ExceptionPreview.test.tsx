import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExceptionPreview, type ExceptionPreviewData } from "./ExceptionPreview";

describe("ExceptionPreview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("preserves Trigger's failure composition with related frame disclosures", () => {
    const { container, root } = render(exception());

    expect(container.textContent).toContain("RuntimeException");
    expect(container.textContent).toContain("Payment failed.");
    expect(container.textContent).toContain("app/Jobs/ChargeCard.php:42");
    expect(container.textContent).not.toContain("Illuminate\\Queue\\Worker->process");

    const showFrames = container.querySelector<HTMLButtonElement>('button[aria-controls="exception-trace"]')!;
    flushSync(() => showFrames.click());
    expect(showFrames.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(`#${showFrames.getAttribute("aria-controls")}`)).not.toBeNull();

    const application = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("App\\Jobs\\ChargeCard->handle"))!;
    expect(application.getAttribute("aria-controls")).toBe("exception-frame-0");
    expect(container.querySelector("#exception-frame-0")).not.toBeNull();

    const vendor = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("1 vendor frame"))!;
    expect(vendor.getAttribute("aria-controls")).toBe("exception-vendor-1");
    flushSync(() => vendor.click());
    expect(container.querySelector("#exception-vendor-1")?.textContent).toContain("Illuminate\\Queue\\Worker->process");

    flushSync(() => root.unmount());
  });

  it("reports clipboard failure instead of false success", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { container, root } = render(exception());
    const copy = container.querySelector<HTMLButtonElement>('button[aria-label="Copy exception as Markdown"]')!;

    await copy.click();
    await vi.waitFor(() => expect(copy.textContent).toContain("Copy failed"));
    expect(copy.getAttribute("title")).toBe("Copy failed");

    flushSync(() => root.unmount());
  });

  it("states when source and frame metadata were not captured", () => {
    const { container, root } = render({ ...exception(), location: null, frames: [] });

    expect(container.textContent).toContain("Source location not captured");
    expect(container.textContent).toContain("Stack trace not captured");
    expect(container.querySelector('[aria-controls="exception-trace"]')).toBeNull();
    expect(container.textContent).not.toContain("PHP ");
    expect(container.textContent).not.toContain("Laravel ");

    flushSync(() => root.unmount());
  });
});

function render(value: ExceptionPreviewData) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(<ExceptionPreview exception={value} />));
  return { container, root };
}

function exception(): ExceptionPreviewData {
  return {
    class: "RuntimeException",
    message: "Payment failed.",
    messageTruncated: false,
    messageOriginalBytes: 15,
    code: "41",
    location: { file: "app/Jobs/ChargeCard.php", line: 42, href: "vscode://file//workspace/app/Jobs/ChargeCard.php:42" },
    frames: [
      {
        file: "app/Jobs/ChargeCard.php",
        line: 42,
        class: "App\\Jobs\\ChargeCard",
        type: "->",
        function: "handle",
        isVendor: false,
        href: "vscode://file//workspace/app/Jobs/ChargeCard.php:42",
        snippet: { code: "public function handle(): void\n{\n    throw new RuntimeException('Payment failed.');\n}", startingLine: 40, highlightedLine: 42 },
      },
      {
        file: "vendor/laravel/framework/src/Illuminate/Queue/Worker.php",
        line: 99,
        class: "Illuminate\\Queue\\Worker",
        type: "->",
        function: "process",
        isVendor: true,
        href: null,
        snippet: null,
      },
    ],
    framesTruncated: false,
    markdown: "# RuntimeException - Job failed\n\nPayment failed.\n",
  };
}
