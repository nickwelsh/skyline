# PROTOTYPE — automatic Laravel queue traces

Question: can Skyline automatically trace unchanged Laravel Jobs, retries, child Jobs, SQL, queue time, and failure without an external collector or changed Job outcomes?

Run:

```sh
./prototype-automatic-queue-traces/run
```

The disposable Laravel 12 fixture uses the official OpenTelemetry PHP SDK, a private provider, a versioned payload envelope, Laravel queue events, and a dedicated SQLite exporter. The command migrates a scratch SQLite database, runs a real database queue worker, verifies the full trace graph and outcomes, then prints its state and verdict.
