export function validateSourceTargetMappings(files) {
  const sources = new Map();
  const targets = new Set();

  for (const file of files) {
    const sourceHash = sources.get(file.source);
    if (sourceHash && sourceHash !== file.sha256) {
      throw new Error(`Conflicting hashes for Trigger source: ${file.source}`);
    }
    sources.set(file.source, file.sha256);

    if (targets.has(file.target)) {
      throw new Error(`Multiple Trigger sources target one module: ${file.target}`);
    }
    targets.add(file.target);
  }
}
