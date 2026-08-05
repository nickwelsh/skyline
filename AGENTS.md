## Agent skills

### Issue tracker

Issues are tracked in Linear project `Skyline` using the `linear` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles map to Linear workflow states. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses the single-context layout. See `docs/agents/domain.md`.

## Git conventions

Work only in the primary checkout on `main`:

- Do not create or use Git worktrees.
- Do not create or switch to other branches.
- Make every change directly on `main`.
- After completing a change, commit it atomically and push `main`.

Keep commits atomic. Use Conventional Commits with a gitmoji for every commit message:

```text
<type>[optional scope]: <gitmoji> <description>

[optional body]

[optional footer(s)]
```
