import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { LoadingBarDivider } from "./LoadingBarDivider";

afterEach(() => {
  document.body.replaceChildren();
});

test("renders the pinned navigation progress divider only while loading", () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  flushSync(() => root.render(<LoadingBarDivider isLoading={false} />));
  expect(container.firstElementChild?.className).toBe("relative h-px w-full overflow-hidden bg-grid-bright");
  expect(container.querySelector(".width-0")).toBeNull();

  flushSync(() => root.render(<LoadingBarDivider isLoading />));
  expect(container.querySelector(".width-0")?.className).toBe(
    "width-0 absolute left-0 top-0 h-full bg-linear-to-r from-transparent from-5% via-blue-500 to-transparent to-95%",
  );
});
