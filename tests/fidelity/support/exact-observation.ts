import { isDeepStrictEqual } from "node:util";

type ExactStableObservationOptions<T, Artifact> = {
  label: string;
  read: () => Promise<T>;
  capture: () => Promise<Artifact>;
  accept?: (observation: T, artifact: Artifact) => boolean | Promise<boolean>;
  advance: () => Promise<void>;
  consecutiveSamples?: number;
  maxCaptures?: number;
  maxSamples?: number;
};

export async function captureExactStableObservation<T, Artifact>({
  label,
  read,
  capture,
  accept,
  advance,
  consecutiveSamples = 3,
  maxCaptures = 3,
  maxSamples = 60,
}: ExactStableObservationOptions<T, Artifact>): Promise<{ observation: T; artifact: Artifact }> {
  let previous: T | undefined;
  let stableSamples = 0;
  let captures = 0;

  for (let sample = 0; sample < maxSamples; sample += 1) {
    const observation = await read();
    requireFiniteEvidence(observation, label);
    stableSamples = previous !== undefined && isDeepStrictEqual(previous, observation) ? stableSamples + 1 : 1;
    previous = observation;

    if (stableSamples >= consecutiveSamples) {
      const artifact = await capture();
      captures += 1;
      const after = await read();
      requireFiniteEvidence(after, label);
      if (isDeepStrictEqual(observation, after) && (!accept || await accept(after, artifact))) return { observation: after, artifact };
      if (captures >= maxCaptures) throw new Error(`${label} did not produce an approved exact artifact within ${maxCaptures} captures.`);
      previous = after;
      stableSamples = 1;
    }

    await advance();
  }

  throw new Error(`${label} did not produce exact stable evidence within ${maxSamples} samples.`);
}

function requireFiniteEvidence(value: unknown, label: string, path = "evidence") {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${label} requires finite evidence at ${path}.`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => requireFiniteEvidence(entry, label, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) requireFiniteEvidence(entry, label, `${path}.${key}`);
  }
}
