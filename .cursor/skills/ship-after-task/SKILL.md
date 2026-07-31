---
name: ship-after-task
description: >-
  After every coding or docs task, run production build checks, fix failures,
  then commit on a feature branch, open a PR, merge to main, and confirm deploy.
  Use when finishing implementation work, when the user asks to ship/deploy/merge,
  or when they want build checks run before every commit.
---

# Ship after task

Default end-of-task workflow for Echo Mirage Cyberdeck (and similar Next.js repos).

**Order:** verify → branch → commit → push → PR → merge → deploy check.

Do not skip because the task "felt small". Do not commit directly to `main`.

## When to run

Run when **all** are true:

1. Implementation for the request is done (not mid-debug).
2. There are repo changes to ship, **or** you fixed build checks triggered by this task.
3. The user did not say skip commit / merge / deploy.

Skip when:

- Question-only or review-only (no edits)
- Only secrets would be staged (`.env`, keys, tokens)
- User explicitly wants a local-only experiment

## 1. Verify (must pass before commit)

Run from repo root. Fix failures before proceeding; loop until green.

### Fast gate (required)

```powershell
pnpm exec tsc --noEmit
```

If local `.next` / `.next-dev` artifacts pollute tsc, delete them first:

```powershell
Remove-Item -Recurse -Force .next,.next-dev -ErrorAction SilentlyContinue
pnpm exec tsc --noEmit
```

### Repo ratchet (required for cyberdeck UI changes)

When touching `src/features/cyberdeck`, `src/components/cyberdeck`, or `src/app/cyberdeck`:

```powershell
pnpm probe:cyberdeck-compile-scope
```

### Full production build (optional unless user asked)

Matches Vercel (`pnpm run build`). Slow (~15–25 min). Run when:

- tsconfig / Next config / major dependency changes
- User asked for deploy confidence
- Prior Vercel failure was webpack-only (not TS)

Otherwise rely on `tsc --noEmit` — that is what failed recent Vercel deploys.

## 2. Branch

Follow `.cursor/rules/feature-branches.mdc`:

```powershell
git fetch origin main
git checkout main
git pull origin main
git checkout -b cursor/<short-kebab-description>
```

Continue on the existing feature branch if this task belongs to an open PR.

## 3. Commit

Parallel first: `git status`, `git diff`, `git log -5 --oneline`.

Then stage task files only, commit with why-focused message:

```powershell
git commit -m @"
Summarize the why in 1-2 sentences.
"@
```

Never commit secrets. Never `--no-verify` unless user asked. Never amend a pushed commit unless user rules allow.

## 4. Push and merge

```powershell
git push -u origin HEAD
```

Create PR with `gh pr create`, then merge:

```powershell
gh pr merge <number> --merge
```

Return the PR URL. Never force-push `main`.

## 5. Deploy check

Echo Mirage deploys via **Vercel on merge to `main`**.

After merge:

1. Tell the user deploy is triggered from `main` (give merge commit SHA).
2. If they paste a Vercel failure log, fix and repeat this skill from step 1.

Optional if `gh` / Vercel integration is available: watch the latest deployment for the merge commit.

## Failure playbook (recent lessons)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot find module` in `scripts/` | Orphan probe; scripts in tsconfig | Delete probe or exclude `scripts` from tsconfig |
| Invalid `CyberdeckPaneKind` literal | Retired pane still referenced | Remove or migrate kind (see `migrateRetiredDemoPaneKind`) |
| Stale server id (`ct`, etc.) | Removed rail still in types/hydration | Align with `SERVER_IDS` in `server-rail-config.ts` |

## Safety

- Never `git push --force` to `main`/`master`
- Never update git config
- Report actual push/merge/deploy results — do not invent success

## Related skills

- [commit-and-push](../commit-and-push/SKILL.md) — commit/push only (no verify/PR/merge)
- User PR rules — use `gh` for all GitHub operations
