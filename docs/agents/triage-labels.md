# Triage roles

Engineering skills speak in five canonical triage roles. Skyline uses Linear workflow states for these transitions instead of triage labels.

| Canonical role | Linear state | Meaning |
| --- | --- | --- |
| `needs-triage` | `Backlog` | Nick still needs to evaluate it |
| `needs-info` | `Backlog` | Waiting for requested information; explain the wait in a comment |
| `ready-for-agent` | `Todo` | Fully specified and ready for an agent |
| `ready-for-human` | `Todo` | Ready for Nick; explain the required human work in a comment |
| `wontfix` | `Canceled` | Will not be actioned; explain why in a comment |

These mappings are routing defaults. Once work starts, review begins, or work ends, use `In Progress`, `In Review`, `Done`, `Canceled`, or `Duplicate` as documented in `docs/agents/issue-tracker.md`.
