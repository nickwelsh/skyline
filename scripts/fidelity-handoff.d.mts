export type FidelityHandoff = {
  schemaVersion: 1;
  spec: string;
  decision: string;
  assemblerSha256: string;
  oracle: {
    bundleSha256: string;
    triggerCommit: string;
    fixtureVersion: string;
    chromiumRevision: string;
    regeneration: { basis: string; decision: string };
    captures: number;
    artifacts: number;
    artifactTypes: Record<string, number>;
  };
  allowedDifferences: {
    sha256: string;
    decision: string;
    regions: Array<{ id: string; category: string; decision: string }>;
  };
};

export function assembleFidelityHandoff(bundle: any, differences: any, bundleBytes: string | Buffer, assemblerBytes: string | Buffer, decision: string): FidelityHandoff;
export function validateFidelityHandoffEnvelope(bundle: any, differences: any, bundleBytes: string | Buffer, assemblerBytes: string | Buffer, handoff: FidelityHandoff): void;
export function verifyFidelityHandoff(root?: string): FidelityHandoff;
export function recordFidelityHandoff(root: string | undefined, decision: string): FidelityHandoff;
