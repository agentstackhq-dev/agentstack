# Agentstack Validation Operating Model

Date: 2026-06-22
Updated: 2026-06-29

This is how Agentstack milestone sessions run after M1 proved the provider path, M2 corrected the generated consumer
shape, and M3 proved the Clerk Billing webhook entitlement path.

## Principles

1. **One validation milestone at a time.** M1 and M2 are complete. M3 has a live pass with cleanup pending. M4 is locked
   until the packaging approach is discussed.
2. **Generated apps stay lean.** Do not add copied framework docs, copied scripts, generated skills, generated provider
   ledgers, root `convex/`, root `vercel.json`, or copied runbooks to consumer apps.
3. **Agentstack owns framework glue.** Provider orchestration, validation, diagnostics, docs/help, evidence, hidden
   state, auth fixtures, and billing fixtures belong in the installed Agentstack package and CLI.
4. **Typed config is the agent feedback boundary.** `agentstack.config.ts` is the current config format. JSON config is
   historical for this repo.
5. **Real provider attempts beat theory.** Ledger every real resource, run provider CLIs until the exact handoff is
   known, and record redacted evidence when live commands run.
6. **No fake readiness.** Distinguish local checks, provider command plans, live reads, live mutations, and evidence
   bundles in docs and command output.

## Current Loops

### M3 Cleanup / Documentation Health

Use this loop while M3 live pass has retained billing resources and M4 is still locked.

1. Read `README.md`, `docs/README.md`, `ARCHITECTURE.md`, `AGENTS.md`, and `docs/milestones/README.md`.
2. If touching live billing resources, also read `docs/milestones/M3-billing-webhook.md`,
   `docs/references/m3-clerk-billing-fixture.md`, and `docs/provider-resource-ledger.md`.
3. Keep docs aligned to the current M1-M3 state without creating M4 tasks.
4. If cleanup runs, update the provider ledger and append redacted evidence.
5. Run focused docs/code checks, `pnpm typecheck`, and `pnpm test` when framework files or templates change.

### M4 Approach Discussion

M4 should not begin implicitly. Before any clean-machine packaging work starts, agree the packaging strategy:

- public npm publish versus local pack/link flow
- package names and versioning
- clean-machine fixture location
- expected install/generate/validate smoke commands
- evidence and cleanup expectations

After agreement, update `docs/milestones/M4-clean-machine-smoke.md` before implementation.

## Completed Milestone Lessons

### M1 Provider-Path Spike

M1 proved real Clerk, Convex, and Vercel preview orchestration could work, but the generated consumer app shape was too
heavy. Do not extend its generated docs/scripts/runbook pattern.

### M2 Lean Generated Surface

M2 proved the corrected product boundary:

```text
agentstack create <tmp-app>
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
```

The generated `package.json` depends on `agentstack`, and package scripts call the installed `agentstack` CLI. Local
and live success paths must invoke the public bin or generated package scripts, not internal helpers such as
`generateProject` or `runAgentstack`.

### M3 Billing Webhook

M3 proved a Clerk Billing feature/plan, real Clerk/Svix webhook delivery to Convex, idempotent replay, and web
entitlement smoke for `feature.auditLog`. The repeatable subscription command is:

```sh
pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
```

The only allowed manual provider work in this path is an exact handoff printed or documented by Agentstack, such as the
Clerk browser SDK test-payment-method setup in `docs/references/m3-clerk-billing-fixture.md`.

## Thread Types

### Documentation Health

**Goal:** Keep canonical docs truthful and navigable.

**Deliverables:**

- Update `README.md`, `ARCHITECTURE.md`, `docs/README.md`, `AGENTS.md`, active milestone cards, or references as needed.
- Mark historical docs when newer milestones supersede their commands or generated-surface assumptions.
- Avoid new one-off docs unless they remove real ambiguity or codify a repeatable workflow.
- Run link/staleness scans or focused tests that match the changed docs.

### Spike

**Goal:** Walk the current milestone path manually. No feature slices unless trivial.

**Deliverables:**

- Milestone card checkboxes updated with pass/fail/not attempted.
- Latest attempt or blocker section updated.
- Ranked list of at most three unblock items, smallest first.
- Honest friction note: is the meta-framework helping?

### Unblock

**Goal:** Fix one blocker from the active milestone path.

**Deliverables:**

- One acceptance criterion moves toward pass.
- Focused tests plus `pnpm typecheck` and `pnpm test` when code changed.
- Evidence appended to `docs/milestones/evidence/<milestone>/` when real commands ran.
- Milestone card updated.

**Rules:**

- No generated consumer-app docs or scripts as a workaround.
- No provider x environment matrix expansion unless it is the named blocker.
- No quality-gate additions unless blocking CI for the milestone.

### Runtime

**Goal:** Generated app behavior for the active milestone: auth, Convex, web/mobile runtime, billing, smoke, and
evidence.

Runtime work must preserve the lean generated surface. If a fix wants to add generated framework files to the consumer
app, move that behavior into the Agentstack package instead.

## Session Checklist

Before coding:

1. Read `README.md`, `docs/README.md`, and `ARCHITECTURE.md`.
2. Read `docs/validation-hypothesis.md`.
3. Read `docs/milestones/README.md`.
4. Read the current milestone card or reference doc for the target area.
5. State which milestone checkbox, cleanup gap, or documentation health gap the session targets.

Before ending:

1. Update the active milestone card or docs index if state changed.
2. Append redacted evidence if real commands ran.
3. Report pass/fail/blocked plus the smallest next step.
4. Do not extend `docs/consumer-production-readiness-progress.md`.
5. Do not start M4 without explicit user direction.

## Forbidden By Default

- Adding copied framework docs to generated apps.
- Adding copied framework scripts to generated apps.
- Adding generated skills to generated apps.
- Reintroducing `agentstack.config.json` for the corrected path.
- Slice-by-slice progress log updates.
- Candidate-evidence or partial-drift diagnostic expansion unrelated to the active blocker.
- Plan-only lifecycle or reconcile artifact additions.
- Readiness percentage updates.
- Claiming pass without evidence.

## Allowed Infra Examples

- Lean generated root-surface enforcement.
- Typed `agentstack.config.ts` schema helpers.
- Package-owned `agentstack help`, `agentstack docs`, or `agentstack explain` style guidance when implemented.
- Package-owned provider bootstrap/link/deploy/smoke/evidence commands.
- Package-owned auth and billing fixture commands.
- Ignored `.agentstack/` state for provider links, ledgers, auth fixtures, billing fixtures, deploy metadata, and smoke
  artifacts.
- Diagnostics that map provider/runtime failures back to typed schema paths and smallest next edits.

## File Layout

```text
README.md                         # Repo entrypoint
AGENTS.md                         # Agent execution rules
ARCHITECTURE.md                   # Current architecture map
docs/
  README.md                       # Docs index and status map
  validation-hypothesis.md        # North star
  validation-operating-model.md   # This file
  provider-resource-ledger.md     # Real provider resource ledger
  references/
    m3-clerk-billing-fixture.md   # Billing fixture workflow
  milestones/
    README.md
    M1-preview-e2e.md             # Complete provider-path spike
    M2-agent-completes-m1.md      # Complete lean generated-surface proof
    M3-billing-webhook.md         # Live billing pass, cleanup pending
    M4-clean-machine-smoke.md     # Locked packaging proof
    evidence/                     # Redacted historical evidence
```
