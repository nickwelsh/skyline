# Source-fidelity handoff

`tests/fidelity/handoff.json` is the review index for the source-faithful interface proof. It binds the accepted NW-216 differences and pinned Trigger commit to the exact NW-227 oracle bundle without claiming an external check passed.

## Record

First generate and verify every paired browser artifact in the pinned Linux container documented in the README. After `pnpm oracle:check` passes, run:

```sh
pnpm handoff:record -- --decision NW-228
pnpm handoff:check
```

Commit the handoff with `tests/fidelity/oracle/bundle.json` and its referenced artifacts. Do not hand-edit it.

## Review

The handoff records:

- the NW-216 spec and closeout decision;
- the exact assembler SHA-256;
- the exact oracle bundle SHA-256;
- the Trigger, fixture, and Chromium pins;
- capture and artifact counts by evidence type;
- oracle regeneration provenance; and
- every accepted-difference region and its decision.

`pnpm handoff:check` first runs the complete static oracle verifier, including reference provenance and artifact hashes. It then reconstructs the handoff and requires exact equality. Missing proof, changed inputs, changed artifacts, or a hand-edited handoff fail closed.

The handoff is not a CI transcript. Reviewers must still run the paired browser suite in the pinned environment.
