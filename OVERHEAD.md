# PROTOTYPE — telemetry overhead guardrail

Question: what wall-time overhead does automatic capture plus isolated SQL persistence add, and what release guardrail can protect the MVP while still capturing every eligible Run?

Run:

```sh
./prototype-automatic-queue-traces/run-overhead
```

Press `r` to run seven alternating baseline/monitored trials of 100 real database-queued Jobs for each workload. Press `d` to switch between summarized medians and raw trial timings.

Workloads:

- No-op: fixed Run/Attempt capture and persistence cost.
- SQL-heavy: ten application queries per Attempt.
- Representative: roughly 10ms deterministic CPU work plus three queries per Attempt.

The monitored path uses the official OTel SDK, private provider, parameterized SQL spans, and a dedicated SQLite exporter flushed transactionally once per Attempt. The baseline keeps the package booted but disables span creation and persistence. Trial order alternates to reduce warmup and drift bias.

Approved release guardrail: median added wall time ≤ `0.8ms + 0.1ms per captured SQL span`, plus ≤10% relative overhead for workloads with a baseline of at least 10ms. Run per supported SQL engine; fail release rather than sampling Runs.
