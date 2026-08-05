import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailedAttemptInspector } from "./FailedAttemptInspector";
import type { ExceptionDetails } from "./dto";

describe("FailedAttemptInspector", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("presents captured application and vendor frames through Trigger interactions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { container, root } = render(exception());

    expect(container.textContent).toContain("RuntimeException");
    expect(container.textContent).toContain("Payment failed.");
    expect(container.textContent).toContain("app/Jobs/ChargeCard.php:42");
    expect(container.textContent).not.toContain("Illuminate\\Queue\\Worker->process");

    const copyMarkdown = container.querySelector<HTMLButtonElement>('button[aria-label="Copy exception as Markdown"]')!;
    await copyMarkdown.click();
    expect(writeText).toHaveBeenCalledWith("# RuntimeException - Job failed\n\nPayment failed.\n");

    const showFrames = container.querySelector<HTMLButtonElement>('button[aria-controls="exception-trace"]')!;
    flushSync(() => showFrames.click());
    expect(showFrames.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('button[aria-label="Wrap application frame 1"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Expand application frame 1"]')).not.toBeNull();

    const vendor = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("1 vendor frame"))!;
    expect(vendor.getAttribute("aria-expanded")).toBe("false");
    flushSync(() => vendor.click());
    expect(container.textContent).toContain("Illuminate\\Queue\\Worker->process");

    flushSync(() => root.unmount());
  });

  it("states when source and frame metadata were not captured", () => {
    const unavailable = { ...exception(), location: null, frames: [] };
    const { container, root } = render(unavailable);

    expect(container.textContent).toContain("Source location not captured");
    expect(container.textContent).toContain("Stack trace not captured");
    expect(container.querySelector('[aria-controls="exception-trace"]')).toBeNull();
    expect(container.textContent).not.toContain("PHP ");
    expect(container.textContent).not.toContain("Laravel ");

    flushSync(() => root.unmount());
  });
});

function render(value: ExceptionDetails) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(<FailedAttemptInspector exception={value} />));
  return { container, root };
}

function exception(): ExceptionDetails {
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
