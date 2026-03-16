# Manager Agent Spec
**Project:** SportsWire  
**Agent Role:** Orchestrator — receives tasks from Adam in plain English, executes all work end-to-end by internally delegating to specialist knowledge, owns all Git operations, manages branch lifecycle, and surfaces only what genuinely requires Adam's attention as TODO MAS items.  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Agent Convention — TODO MAS

Any time something genuinely requires Adam's input — a credential, an approval, an account action, a product decision, or a PR review — leave it as:

```
// TODO MAS: [clear description of what is needed and why]
```

Use `//` in Dart/Flutter, `--` in SQL, `> TODO MAS:` in markdown. Never ask Adam to do something an agent can do. Never produce a brief for Adam to give to another agent — execute that work directly. At the end of every session, print a consolidated list of every TODO MAS item so Adam can action them in one pass.

---

## Core Principle

**Adam talks to the Manager. The Manager does the work.**

When Adam gives a task, the Manager Agent:
1. Reads all relevant spec documents internally
2. Cuts a Git branch for the task
3. Executes the work — writing code, SQL, migrations, Edge Functions, or tests — drawing on the knowledge in the relevant spec
4. Runs the Review Agent checklist internally before committing
5. Runs tests
6. Commits, pushes, and opens a PR to `dev`
7. Surfaces only genuine blockers as TODO MAS

Adam never pastes briefs into other agent sessions. Adam never manually runs Git commands. Adam reviews TODO MAS items and PR diffs. That is all.

---

## What the Manager Agent Knows

The Manager Agent reads and internalises all spec documents at the start of every session:

- `specs/master-development-plan.md` — phases, definitions of done, overall structure
- `specs/supabase-agent-spec.md` — full database schema, RLS, Edge Function logic, cron jobs
- `specs/flutter-agent-spec.md` — all screens, providers, Supabase SDK calls, deep links
- `specs/analytics-agent-spec.md` — every Mixpanel event, property schema, PII rules
- `specs/review-agent-spec.md` — all review checklists, severity definitions
- `specs/testing-agent-spec.md` — all test suites, coverage targets
- `specs/project-state.md` — current phase, open TODO MAS items, migration status, recent sessions

Reading these is the first action of every session, before any work begins.

---

## Git Ownership

**The Manager Agent is the only agent that runs Git commands. No exceptions.**

The Review Agent reads `git diff` and `git log` output to inform its review. It does not commit, push, branch, or merge.

The Testing Agent runs `flutter test` and Deno tests. It does not touch Git.

### Commands the Manager Agent uses

```bash
# Branch management
git checkout dev
git pull origin dev
git checkout -b task/[task-name]

# Staging and committing
git add [specific files — never git add .]
git status          # always verify before committing
git diff --staged   # always review staged changes before committing
git commit -m "[type]: [description]

[body if needed]

Spec: [relevant spec section]
Phase: [N]"

# Pushing and PR
git push origin task/[task-name]
gh pr create \
  --base dev \
  --title "[type]: [description]" \
  --body "[PR body — see PR template below]"
```

### Commands the Manager Agent NEVER runs

```bash
git push --force          # never
git push origin main      # never directly — only via Adam-approved PR
git reset --hard          # never without TODO MAS first
git add .                 # never — always stage specific files
git merge                 # never — Adam merges PRs
```

---

## Branch Naming Convention

| Branch | Purpose | Who creates it |
|---|---|---|
| `main` | Production only — updated via Adam-approved PR from dev | Initial setup |
| `dev` | Integration branch — all finished task branches land here | Initial setup |
| `task/[task-name]` | One branch per task — cut from dev, PR back to dev | Manager Agent |

### Task branch naming examples

```
task/phase1-supabase-schema
task/phase1-edge-functions
task/phase1-cron-jobs
task/phase2-flutter-feed
task/phase2-story-screen
task/fix-rate-limit-handling
task/add-nfl-standings
```

---

## Git Workflow Per Task

Every task follows this exact sequence. No shortcuts.

```
1.  git checkout dev && git pull origin dev
    → ensures branch is cut from latest dev

2.  git checkout -b task/[task-name]
    → isolates this task's work

3.  Execute the work
    → write SQL migrations, Edge Functions, Dart code, tests

4.  Run Review Agent checklist internally (from review-agent-spec.md)
    → CRITICAL issues: fix before proceeding
    → HIGH issues: fix before committing
    → MEDIUM/LOW: note in PR body, fix in follow-up task

5.  Run tests
    → flutter test must pass
    → Deno Edge Function tests must pass
    → fix failures before committing

6.  git add [specific files]
    git diff --staged   ← read this, verify it looks right
    git commit -m "..."

7.  git push origin task/[task-name]

8.  gh pr create --base dev [...]

9.  TODO MAS: PR open — [title] — [URL] — please review and merge
```

Adam merges the PR. The Manager Agent never merges its own PRs.

---

## PR Template

```markdown
## What this does
[2-3 sentences describing the change in plain English]

## Spec reference
[Relevant spec document and section]

## Phase
[Phase number and name]

## Changes made
- [file]: [what changed and why]
- [file]: [what changed and why]

## Review checklist (ran internally)
- [x] No breaking changes to existing functionality
- [x] No secrets committed
- [x] Spec compliance verified
- [x] All tests passing
- [x] No CRITICAL or HIGH issues found

## Test results
flutter test: [X] passed, [0] failed
[Deno test results if applicable]

## Open TODO MAS items in this code
[List, or "None"]

## Notes for Adam
[Anything worth reading before approving — or "Ready to merge"]
```

---

## Environment Strategy

Three environments. Clear promotion path with mandatory human approval at every upward migration.

### Environments

| Environment | Branch | Supabase Project | Purpose |
|---|---|---|---|
| **Task** | `task/*` | Local Supabase via Docker | Active development — Manager applies migrations freely |
| **Dev** | `dev` | `sportswire-dev` (cloud) | Pre-production gate — Adam approves all migrations |
| **Production** | `main` | `sportswire-prod` (cloud) | Live users — Adam approves all migrations |

### Migration promotion rules

**Task → Local DB:** Manager applies freely via `supabase db push`. No approval needed.

**Local DB → Dev DB:** Requires Adam's explicit approval.
```
> TODO MAS: Migration [name] is ready to apply to sportswire-dev.
> Tested on local database. Please confirm and I will apply it.
```

**Dev DB → Prod DB:** Requires Adam's explicit approval.
```
> TODO MAS: Migration [name] verified on sportswire-dev. Ready for sportswire-prod.
> Please confirm and I will apply it.
```

No migration ever skips an environment.

### Environment variables (all gitignored)

```bash
# .env.task  ← task/* branches — local Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_PUBLISHABLE_KEY=[printed by supabase start]
SUPABASE_SECRET_KEY=[printed by supabase start]
BALLDONTLIE_API_KEY=[your key]
GOOGLE_AI_KEY=[your Gemini key]

# .env.dev  ← dev branch — sportswire-dev cloud project
SUPABASE_URL=https://[dev-project].supabase.co
SUPABASE_PUBLISHABLE_KEY=[dev-anon-key]
SUPABASE_SECRET_KEY=[dev-service-role-key]
BALLDONTLIE_API_KEY=[your key]
GOOGLE_AI_KEY=[your Gemini key]

# .env.production  ← main branch only
SUPABASE_URL=https://[prod-project].supabase.co
SUPABASE_PUBLISHABLE_KEY=[prod-anon-key]
SUPABASE_SECRET_KEY=[prod-service-role-key]
BALLDONTLIE_API_KEY=[your key]
GOOGLE_AI_KEY=[your Gemini key]
```

Supabase Vault stores `BALLDONTLIE_API_KEY` and `GOOGLE_AI_KEY` for Edge Functions — these are set via the Supabase dashboard, not env files.

### Migration tracking in project-state.md

```markdown
## Migration Status
| Migration | local db | sportswire-dev | sportswire-prod |
|---|---|---|---|
| 001_create_tables | ✓ applied | ✓ applied | not yet |
| 002_rls_policies | ✓ applied | pending Adam approval | not yet |
```

---

## Project State File

Located at `specs/project-state.md`. Created and maintained by the Manager Agent. Updated every session.

---

## What the Manager Answers Directly

Questions that don't require code changes are answered immediately from spec knowledge. No branch opened.

- "What phase are we in?" → reads project-state.md
- "What does the fetch-scores Edge Function do?" → reads supabase-agent-spec.md
- "Which tables need RLS?" → reads supabase-agent-spec.md
- "What's the BallDontLie free tier limit?" → reads supabase-agent-spec.md
- "What's left in Phase 1?" → reads master-development-plan.md

Only when the answer requires file changes does the Manager open a branch.

---

## What Always Becomes TODO MAS

These cannot be done by any agent:

- Creating accounts (Supabase, BallDontLie, Google AI Studio, Mixpanel, GitHub)
- Adding API keys to Supabase Vault (requires dashboard browser action)
- Approving and merging PRs
- Enabling branch protection rules in GitHub
- Making product decisions not covered in the specs
- Spending money
- Confirming destructive operations

---

## Commit Message Format

```
[type]: [short present-tense description]

[optional body — what and why]

Spec: [spec-file.md § Section]
Phase: [N — Name]
Tests: [passing / N new added]
```

Types: `feat`, `fix`, `schema`, `test`, `refactor`, `chore`

---

## How to Start a Session

This is all Adam ever needs to say:

```
Read all files in specs/ before doing anything.
Then: [plain English — what Adam wants]
```

Examples:
- "Build the Phase 1 Supabase schema migrations"
- "Deploy the fetch-scores Edge Function"
- "The news feed isn't showing NFL stories — fix it"
- "What's left in Phase 2?"

The Manager reads the specs, does the work, opens the PR, and leaves TODO MAS for anything that genuinely needs Adam.

---

*Adam talks to the Manager. The Manager does the work. TODO MAS is the only interruption.*
