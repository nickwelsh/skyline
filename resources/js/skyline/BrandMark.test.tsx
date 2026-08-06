import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  test("matches the pinned two-letter organization avatar geometry", () => {
    const markup = renderToStaticMarkup(<BrandMark name="Fixture Laravel" />);

    expect(markup).toContain("size-5");
    expect(markup).toContain(">Fi</span>");
  });
});
