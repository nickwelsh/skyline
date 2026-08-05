import type { SkylineBootstrap } from "./dto";

export function readBootstrap(): SkylineBootstrap {
  const element = document.getElementById("skyline-bootstrap");

  if (!(element instanceof HTMLScriptElement) || element.type !== "application/json") {
    throw new Error("Skyline bootstrap is missing.");
  }

  const value = JSON.parse(element.textContent ?? "null") as Partial<SkylineBootstrap> | null;

  if (
    value === null
    || typeof value.basePath !== "string"
    || typeof value.applicationName !== "string"
    || typeof value.environmentLabel !== "string"
    || typeof value.capabilities !== "object"
    || value.capabilities === null
  ) {
    throw new Error("Skyline bootstrap is invalid.");
  }

  return value as SkylineBootstrap;
}
