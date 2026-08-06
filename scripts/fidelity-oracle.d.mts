export type FidelityMatrix = {
  schemaVersion: number;
  roots: string[];
  details: string[];
  rootStates: string[];
  detailStates: string[];
  ownedStates: Record<string, string[]>;
  primary: { viewport: [number, number]; themes: string[] };
  core: { viewports: Array<[number, number]>; theme: string; shellStates: string[] };
  system: { viewport: [number, number]; schemes: string[]; states: string[] };
  actions: string[];
};

export function expectedCaptureIds(matrix: FidelityMatrix): string[];
export function fidelityInputHashes(root?: string): Record<string, string>;
export function validateAllowedDifferences(differences: unknown): void;
export function validateFidelityBundleEnvelope(environment: unknown, matrix: FidelityMatrix, actions: unknown, bundle: unknown): void;
export function verifyFidelityBundle(root?: string): {
  fixtureVersion: string;
  triggerCommit: string;
  chromiumRevision: string;
  artifacts: number;
};
export function recordFidelityBundle(root: string | undefined, decision: string): unknown;
