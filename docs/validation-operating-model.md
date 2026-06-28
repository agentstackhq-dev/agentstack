# Agentstack Validation Operating Model

Date: 2026-06-22
Updated: 2026-06-28

How we run coding-agent threads after M1 proved the live provider path but exposed the wrong generated consumer shape.

## Principles

1. **One milestone active at a time.** M1 is complete as a provider-path spike. Do not start M2 execution until the lean generated-surface correction unlocks it.
2. **Generated apps must stay lean.** Do not add copied framework docs, copied scripts, generated skills, generated provider ledgers, or copied runbooks to consumer apps.
3. **Agentstack owns framework glue.** Provider orchestration, validation, diagnostics, docs/help, evidence, and hidden state belong in the installed Agentstack package and CLI.
4. **Typed config is the agent feedback boundary.** `agentstack.config.ts` must be schema-driven from the package so TypeScript and CLI diagnostics point agents to precise config paths and fixes.
5. **Real provider attempts still beat mock-only proof expansion.** Ledger every real resource, but keep ledger/evidence state in package-owned or ignored `.agentstack/` surfaces, not generated app docs.

## Current correction loop

Before M2 can unlock, a correction slice must prove the generated app behaves like an app using a meta-framework:

1. Run `create-agent-stack <tmp-app>`.
2. Verify the generated root surface is limited to:

   ```text
   apps/mobile
   apps/web
   apps/convex
   agentstack.config.ts
   AGENTS.md
   .gitignore
   package.json
   ```

   Package-manager lockfiles may appear after install.

3. Verify the app root does **not** contain copied `docs/`, `scripts/`, `skills/`, root `convex/`, `vercel.json`, provider ledger source files, or copied M1 runbooks.
4. Verify `package.json` depends on Agentstack and scripts call `agentstack`.
5. Verify `agentstack.config.ts` imports a typed schema helper from the Agentstack package.
6. Run package-owned local validation from the generated app.
7. Record evidence in this Agentstack framework repo.

Only after this correction loop passes should M2 attempt the fresh-agent preview path.

## M2 preview loop

M2 should use package-owned CLI commands from the lean generated app. The exact command names must be discoverable through package-owned help, not generated runbooks.

Conceptually, the fresh agent must be able to:

1. Bootstrap or reuse preview Clerk, Convex, and Vercel resources.
2. Link provider resources to ignored local Agentstack state.
3. Deploy the web app to Vercel preview.
4. Create/reuse/update/delete the Clerk smoke user fixture.
5. Sign in and prove one protected Convex data path.
6. Produce redacted evidence in this framework repo.

Provider auth and CLI setup are still part of the work. If a provider CLI requires browser login, account selection, or project selection, run the CLI until it prints the exact handoff, record that as the current blocker, and resume from the same command after the user completes it.

## Thread types

### Correction

**Goal:** Replace the generated-app shape with the lean package-driven contract.

**Deliverables:**

- M2 card updated if requirements change
- Focused tests for generated root shape, typed config, and package-owned command usage
- `pnpm typecheck` and `pnpm test`
- Evidence appended under `docs/milestones/evidence/` if live or generated-app verification ran

### Spike

**Goal:** Walk the current milestone path manually. No feature slices unless trivial.

**Deliverables:**

- Milestone card checkboxes updated (pass / fail / not attempted)
- Last attempt or blocker section updated
- Ranked list of at most 3 unblock items, smallest first
- Honest friction note: is the meta-framework helping?

### Unblock

**Goal:** Fix one blocker from the active milestone path.

**Deliverables:**

- One acceptance criterion moves toward pass
- Focused tests plus `pnpm typecheck` and `pnpm test` when code changed
- Evidence appended to `docs/milestones/evidence/<milestone>/`
- Milestone card updated

**Rules:**

- No new generated consumer-app docs or scripts as a workaround
- No provider x environment matrix expansion
- No quality-gate additions unless blocking CI for the milestone
- No new documentation unless it changes package-owned CLI behavior or prevents stale guidance

### Runtime

**Goal:** Generated app behavior for the active milestone: auth, Convex, web/mobile runtime, smoke, and evidence.

Runtime work must still preserve the lean generated surface. If a fix wants to add generated framework files to the consumer app, move that behavior into the Agentstack package instead.

## Session checklist

Before coding:

1. Read `docs/validation-hypothesis.md`
2. Read `docs/milestones/README.md`
3. Read the current milestone card
4. Read `AGENTS.md`
5. State which acceptance checkbox this session targets

Before ending:

1. Update the milestone card
2. Append redacted evidence if real commands ran
3. Report pass / fail / blocked plus the smallest next step
4. Do not extend `docs/consumer-production-readiness-progress.md`

## Forbidden by default

- Adding copied framework docs to generated apps
- Adding copied framework scripts to generated apps
- Adding generated skills to generated apps
- Using `agentstack.config.json` for the corrected path
- Slice-by-slice progress log updates
- Candidate-evidence or partial-drift diagnostic expansion unrelated to the active blocker
- Plan-only lifecycle or reconcile artifact additions
- Readiness percentage updates
- Claiming pass without evidence

## Allowed infra examples

- Lean generated root-surface enforcement
- Typed `agentstack.config.ts` schema helpers
- Package-owned `agentstack docs`, `agentstack explain`, and command help
- Package-owned provider bootstrap/link/deploy/smoke/evidence commands
- Ignored `.agentstack/` state for provider links, ledgers, auth fixtures, deploy metadata, and smoke artifacts
- Diagnostics that map provider/runtime failures back to typed schema paths and smallest next edits

## File layout

```text
docs/
  validation-hypothesis.md      # North star
  validation-operating-model.md # This file
  milestones/
    README.md
    M1-preview-e2e.md           # Complete provider-path spike
    M2-agent-completes-m1.md    # Locked lean generated-surface contract
    evidence/
      M1-preview-e2e/           # Historical redacted M1 evidence
```
