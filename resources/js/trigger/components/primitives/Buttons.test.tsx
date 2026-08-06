import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test } from "vitest";
import { Button, LinkButton } from "./Buttons";
import { OperatingSystemContextProvider } from "./OperatingSystemProvider";
import { ShortcutsProvider } from "./ShortcutsProvider";

afterEach(() => document.body.replaceChildren());

test("LinkButton derives an accessible name only from a string tooltip", () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  flushSync(() => createRoot(container).render(
    <MemoryRouter>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <LinkButton to="/next" variant="secondary/small" tooltip="Next" />
          <LinkButton to="/explicit" variant="secondary/small" tooltip="Fallback" aria-label="Explicit" />
          <LinkButton to="/rich" variant="secondary/small" tooltip={<span>Rich</span>} />
          <Button variant="secondary/small" tooltip="Button tooltip" aria-label="Button label" />
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </MemoryRouter>,
  ));

  expect(container.querySelector('a[href="/next"]')?.getAttribute("aria-label")).toBe("Next");
  expect(container.querySelector('a[href="/explicit"]')?.getAttribute("aria-label")).toBe("Explicit");
  expect(container.querySelector('a[href="/rich"]')?.hasAttribute("aria-label")).toBe(false);
  expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Button label");
});
