import { describe, expect, test, vi } from "vitest";
import { captureExactStableObservation } from "./exact-observation";

describe("exact observer stability", () => {
  test("captures only after one exact finite state repeats and remains unchanged", async () => {
    const crossing = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 4] };
    const stable = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [5, 6, 7, 8] };
    const read = sequence([crossing, stable, stable, stable, stable]);
    const capture = vi.fn(async () => "pixels");

    await expect(captureExactStableObservation({ label: "breadcrumb", read, capture, advance: async () => {} }))
      .resolves.toEqual({ observation: stable, artifact: "pixels" });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  test("retries when the screenshot crosses into another exact state", async () => {
    const before = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 4] };
    const after = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [5, 6, 7, 8] };
    const read = sequence([before, before, before, after, after, after, after]);
    const capture = vi.fn(async () => capture.mock.calls.length);

    await expect(captureExactStableObservation({ label: "branding", read, capture, advance: async () => {} }))
      .resolves.toEqual({ observation: after, artifact: 2 });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  test("retries when exact evidence brackets an unapproved screenshot pair", async () => {
    const stable = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 4] };
    const capture = vi.fn(async () => capture.mock.calls.length === 1 ? "crossed" : "approved");
    const accept = vi.fn((_observation, artifact: string) => artifact === "approved");

    await expect(captureExactStableObservation({ label: "breadcrumb pixels", read: async () => stable, capture, accept, advance: async () => {} }))
      .resolves.toEqual({ observation: stable, artifact: "approved" });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(accept).toHaveBeenCalledTimes(2);
  });

  test("fails closed when every bracketed screenshot pair is unapproved", async () => {
    const stable = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 4] };
    const capture = vi.fn(async () => "crossed");

    await expect(captureExactStableObservation({
      label: "breadcrumb pixels",
      read: async () => stable,
      capture,
      accept: () => false,
      advance: async () => {},
      maxCaptures: 2,
    })).rejects.toThrow(/approved exact artifact/i);
    expect(capture).toHaveBeenCalledTimes(2);
  });

  test("fails closed on alternating quads and non-finite geometry", async () => {
    const first = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 4] };
    const second = { rect: { x: 1, y: 2, width: 9, height: 20 }, quads: [1, 2, 3, 5] };
    await expect(captureExactStableObservation({
      label: "breadcrumb quads",
      read: sequence([first, second, first, second]),
      capture: async () => "pixels",
      advance: async () => {},
      maxSamples: 4,
    })).rejects.toThrow(/exact stable evidence/i);

    await expect(captureExactStableObservation({
      label: "breadcrumb geometry",
      read: async () => ({ rect: { x: Number.NaN, y: 2, width: 9, height: 20 } }),
      capture: async () => "pixels",
      advance: async () => {},
    })).rejects.toThrow(/finite evidence/i);
  });
});

function sequence<T>(values: T[]) {
  let index = 0;
  return vi.fn(async () => values[Math.min(index++, values.length - 1)]);
}
