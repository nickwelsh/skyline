# Isolate telemetry persistence by Trace

Skyline will persist normalized Trace, Run, Attempt, and immutable span records through a dedicated cloned Laravel connection, using short idempotent transactions for immediate lifecycle state and terminal span batches. Retention is evaluated from each Trace's latest activity using the current configured cutoff and prunes whole inactive Traces, while connection and reentrancy guards prevent self-observation and every persistence failure is discarded with rate-limited logging so telemetry cannot alter Job behavior.
