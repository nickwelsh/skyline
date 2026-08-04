# Issue tracker: Linear

Issues and PRDs live in Linear workspace `nickwelsh`, team `NW`, project `Skyline`. Use the `linear` CLI for all issue operations.

The repo's `.linear.toml` selects the workspace and team. Linear has no default-project config, so always pass `--project Skyline` when creating or querying issues.

## Authentication

Verify access before issue work:

```sh
linear auth whoami
```

This installed CLI uses `linear --help` and `linear <command> --help`; `linear help` is not a valid command in version 2.3.0.

The API key is stored in the macOS Keychain. In a sandboxed agent process, a missing-keyring warning can mean Keychain access is blocked even though the user's terminal is authenticated. Rerun the command with host/Keychain access. Do not copy the key into the repo, set `LINEAR_API_KEY`, or use `linear auth login --plaintext`.

## Conventions

Use full Linear identifiers such as `NW-123`, not GitHub-style `#123` references.

- **Create in Backlog**: `linear issue create --team NW --project Skyline --state Backlog --title "..." --description-file <path> --no-interactive`
- **Read**: `linear issue view NW-123 --json`
- **List/search**: `linear issue query --team NW --project Skyline --all-states --json --limit 0`; add `--search "..."` or type filters such as `--state backlog --state unstarted` as needed.
- **Comment**: `linear issue comment add NW-123 --body-file <path>`
- **Update**: `linear issue update NW-123 --state "..."`; include `--assignee self` only when claiming work.
- **Link a PR or artifact**: `linear issue link NW-123 <url>`
- **Add a dependency**: `linear issue relation add NW-123 blocked-by NW-100`
- **Mark a duplicate**: `linear issue relation add NW-123 duplicate NW-100`, then set `Duplicate`.

Prefer `--description-file` and `--body-file` for Markdown. Never delete an issue to finish it; use its terminal workflow state.

## Workflow states

Update state when the work changes phase, not later in a batch.

| Situation | State |
| --- | --- |
| Newly captured, not yet selected | `Backlog` |
| Nick should work on it next | `Todo` |
| Work has started | `In Progress` |
| Implementation is waiting on review or QA | `In Review` |
| Work and required review are complete | `Done` |
| Work will not be done | `Canceled` |
| Another issue already represents the work | `Duplicate` |

`Canceled` is Linear's configured spelling of “Cancelled.” When beginning an issue, set `In Progress` before changing code. At a review handoff, set `In Review`; do not set `Done` while review remains. Use `Done`, `Canceled`, or `Duplicate` only as appropriate.

```sh
linear issue update NW-123 --state Todo
linear issue update NW-123 --state "In Progress" --assignee self
linear issue update NW-123 --state "In Review"
linear issue update NW-123 --state Done
```

## Pull requests

PRs are not a request or triage surface. Track the work in Linear and link the PR to its issue. Use GitHub tooling only for PR operations.

## Skill translations

When a skill says “publish to the issue tracker,” create a `Skyline` issue in `Backlog` unless the skill or user explicitly selected it for work.

When a skill says “fetch the relevant ticket,” run `linear issue view <NW-id> --json` so the body, comments, status, relations, and metadata are available.

When a skill asks to apply a canonical triage label, use the workflow-state mapping in `docs/agents/triage-labels.md`; Skyline does not use triage labels as workflow state.

## Wayfinding operations

Used by `/wayfinder`. The **map** is one Linear issue with **sub-issues** as decision tickets.

- **Map**: create a `Skyline` issue labelled `wayfinder:map`, with Notes / Decisions-so-far / Fog in its description.
- **Child ticket**: create with `--parent <map-id>` and the appropriate `wayfinder:<type>` label (`research`, `prototype`, `grilling`, or `task`). Keep it in `Backlog` until selected; use `Todo` when queued.
- **Blocking**: use native relations: `linear issue relation add <child-id> blocked-by <blocker-id>`.
- **Frontier query**: run `linear issue query --team NW --project Skyline --state backlog --state unstarted --json --limit 0`, keep the map's children, then exclude assigned issues and any with unresolved `blocked-by` relations from `linear issue relation list <id>`. First in map order wins.
- **Claim**: `linear issue update <id> --state "In Progress" --assignee self` — the session's first write.
- **Resolve**: post the answer as a comment, update the ticket to `Done`, then update the map's Decisions-so-far with a pointer to the durable context.
