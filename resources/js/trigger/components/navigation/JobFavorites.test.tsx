import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { OperatingSystemContextProvider } from "../primitives/OperatingSystemProvider";
import { FavoritesProvider, JobFavoriteButton, useJobFavorites } from "./JobFavorites";

afterEach(() => document.body.replaceChildren());

test("keeps stored favorites dormant without exposing mutation controls", () => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);

  flushSync(() => createRoot(container).render(
    <OperatingSystemContextProvider platform="linux">
      <FavoritesProvider favorites={[{ id: "saved", label: "Saved", path: "/runs/saved" }]} onChange={onChange} enabled={false}>
        <FavoriteCount />
        <JobFavoriteButton id="current" label="Current" path="/runs/current" />
      </FavoritesProvider>
    </OperatingSystemContextProvider>,
  ));

  expect(container.querySelector('[data-testid="favorite-count"]')?.textContent).toBe("0");
  expect(container.querySelector("button")).toBeNull();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", altKey: true }));
  expect(onChange).not.toHaveBeenCalled();
});

function FavoriteCount() {
  return <span data-testid="favorite-count">{useJobFavorites().length}</span>;
}
