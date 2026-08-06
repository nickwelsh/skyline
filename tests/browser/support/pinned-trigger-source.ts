import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../../fidelity/reference-import-manifest.json" with { type: "json" };

const root = resolve(import.meta.dirname, "../../..");
const sources = new Map(manifest.files.map((file) => [file.source, file]));

export function pinnedTriggerCommit() {
  return manifest.commit;
}

export function readPinnedTriggerSource(source: string) {
  const file = sources.get(source);
  if (!file) throw new Error(`Pinned Trigger source is not vendored: ${source}`);
  return readFileSync(resolve(root, file.target));
}
