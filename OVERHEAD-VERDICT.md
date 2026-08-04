# Verdict

Validated by Nick on 2026-08-04: **adopt the measured guardrail**.

- Fixed capture/persistence cost measured 0.575–0.603ms per Attempt.
- Ten-query cost measured 1.153–1.294ms per Attempt.
- Representative CPU-plus-three-query cost measured 0.789–1.024ms, or 5.2–6.9%.
- Guardrail: median added time ≤ `0.8ms + 0.1ms per captured SQL span`.
- Additional guardrail: ≤10% relative overhead when baseline work is at least 10ms.
- Method: seven alternating 100-Job trials per supported SQL engine.
- Failure policy: block release and optimize; never sample eligible Runs.
