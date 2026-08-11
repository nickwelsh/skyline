# Skyline

Skyline observes queued work and presents its execution history without owning job execution.

## Language

**Application**:
The installed Laravel application observed by one Skyline dashboard instance.
_Avoid_: Organization, project

**Job**:
One unit of work submitted through Laravel's queue system, including custom jobs and framework-generated queued work such as listeners, mailables, notifications, closures, batches, and chains.
_Avoid_: Task, payload

**Job type**:
A named kind of Job. Jobs with the same type share an observable identity but remain distinct units of work.
_Avoid_: Task, Job definition

**Run**:
The lifecycle of one logical Job, from dispatch through final success or failure. A Run may contain multiple Attempts.
_Avoid_: Execution, invocation

**Attempt**:
One processing try within a Run. A retry creates a new Attempt for the same Run.
_Avoid_: Run, retry

**Error group**:
A set of failed Attempts for one Job type that share the same exception identity.
_Avoid_: Error, issue

**Telemetry event**:
One time-ordered observable occurrence within a Run, represented by either a recorded operation or a captured application log.
_Avoid_: Log, breadcrumb

**Trace**:
A causally connected group of Runs rooted in one originating Run. Runs dispatched during an active Attempt join its Trace as children.
_Avoid_: Run, batch

**Queue time**:
The elapsed time between Laravel reporting a Job as queued and an Attempt beginning processing. It includes intentional delay and worker wait.
_Avoid_: Worker wait

**Queue target**:
A named destination identified by a queue connection and queue name, observed from confirmed Runs.
_Avoid_: Queue, broker
