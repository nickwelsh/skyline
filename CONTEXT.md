# Skyline

Skyline observes queued work and presents its execution history without owning job execution.

## Language

**Job**:
One unit of work submitted through Laravel's queue system, including custom jobs and framework-generated queued work such as listeners, mailables, notifications, closures, batches, and chains.
_Avoid_: Task, payload

**Run**:
The lifecycle of one logical Job, from dispatch through final success or failure. A Run may contain multiple Attempts.
_Avoid_: Execution, invocation

**Attempt**:
One processing try within a Run. A retry creates a new Attempt for the same Run.
_Avoid_: Run, retry

**Trace**:
A causally connected group of Runs rooted in one originating Run. Runs dispatched during an active Attempt join its Trace as children.
_Avoid_: Run, batch

**Queue time**:
The elapsed time between Laravel reporting a Job as queued and an Attempt beginning processing. It includes intentional delay and worker wait.
_Avoid_: Worker wait
