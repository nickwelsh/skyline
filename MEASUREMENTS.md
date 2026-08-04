# Measurements

Environment: arm64 macOS 26.5.2, PHP 8.5.8 with Xdebug, Laravel 12.64.0, OpenTelemetry SDK 1.15.0, SQLite 3.45.2.

Method: seven alternating baseline/monitored trials of 100 database-queued Jobs per workload. Values are median wall time per Job from dispatch through queue drain. Monitored spans flush transactionally to a dedicated SQLite database once per Attempt. Every Run is captured.

## Corrected run 1

| Workload | Baseline | Monitored | Added | Relative | Spans/Job | SQL/Job |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No-op | 2.759ms | 3.362ms | 0.603ms | 21.8% | 4 | 2 |
| 10 SQL | 3.536ms | 4.689ms | 1.153ms | 32.6% | 14 | 12 |
| CPU + 3 SQL | 14.940ms | 15.964ms | 1.024ms | 6.9% | 7 | 5 |

## Corrected run 2

| Workload | Baseline | Monitored | Added | Relative | Spans/Job | SQL/Job |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No-op | 3.112ms | 3.687ms | 0.575ms | 18.5% | 4 | 2 |
| 10 SQL | 3.355ms | 4.649ms | 1.294ms | 38.6% | 14 | 12 |
| CPU + 3 SQL | 15.066ms | 15.856ms | 0.789ms | 5.2% | 7 | 5 |

The earlier sleep-based representative workload was rejected because scheduler variance produced a physically misleading negative delta. Deterministic CPU work replaced it before these recorded runs.

## Approved guardrail

Nick approved on 2026-08-04:

> Across seven alternating 100-Job trials, median added wall time per Attempt must remain at or below `0.8ms + 0.1ms per captured SQL span`. Workloads with a baseline of at least 10ms must also remain at or below 10% relative overhead.

Run the benchmark for each supported SQL engine. A breach blocks release and requires optimization; it never enables sampling or excludes an otherwise eligible Run.
