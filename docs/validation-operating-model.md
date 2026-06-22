# Agentstack Validation Operating Model

Date: 2026-06-22

How we run coding-agent threads after pivoting from open-ended "consumer readiness" expansion to **hypothesis-driven milestones**.

## Principles

1. **Every thread moves an E2E checkbox, produces evidence for a failed attempt, or recommends kill/pivot.**
2. **Infra is welcome** when it unblocks the active milestone — not when it expands diagnostic coverage.
3. **One milestone active at a time.** Finish or kill M1 before treating M2 as active.
4. **Real provider attempts beat mock-only proof expansion.** Ledger every real resource.

## Thread types

### Spike (0–1 sessions, read-only preferred)

**Goal:** Walk the active milestone path manually. No feature slices unless trivial.

**Deliverables:**

- Milestone card checkboxes updated (pass / fail / not attempted)
- `Last E2E attempt` section filled in
- Ranked list of ≤3 unblock items (smallest first)
- Honest friction note: is the meta-framework helping?

**Prompt:** See `docs/milestones/THREAD-KICKOFF.md` → Spike.

### Unblock (1–3 sessions, surgical)

**Goal:** Fix **one** blocker from the spike list.

**Deliverables:**

- One acceptance criterion moves toward pass
- Focused tests + `pnpm typecheck` + `pnpm test`
- Evidence appended to `docs/milestones/evidence/<milestone>/`
- Milestone card updated

**Rules:**

- No new CLI commands unless they replace a manual E2E step
- No provider × environment matrix expansion
- No quality-gate additions (format/lint/generated) unless blocking CI for the milestone

**Prompt:** See `docs/milestones/THREAD-KICKOFF.md` → Unblock.

### Runtime (after provider path is proven or clearly runtime-blocked)

**Goal:** Generated app behavior — auth, Convex, smoke — for the active milestone.

**Prompt:** See `docs/milestones/THREAD-KICKOFF.md` → Runtime.

## Session checklist (agents)

Before coding:

1. Read `docs/validation-hypothesis.md`
2. Read the active `docs/milestones/M*.md`
3. Read `AGENTS.md`
4. State which acceptance checkbox this session targets

Before ending:

1. Update the milestone card (checkboxes, blocker, last E2E attempt)
2. Append redacted evidence if any real commands ran
3. Report: pass / fail / blocked + smallest next step
4. Do **not** extend `docs/consumer-production-readiness-progress.md`

## Cadence (human)

After each milestone thread batch:

1. **Demo** — run the E2E path live (~5 min)
2. **Score** — where did generated guidance lie or help?
3. **Decide** — pass → next milestone; fail → unblock thread or kill/pivot per hypothesis doc

## Forbidden by default (validation threads)

- Slice-by-slice progress log updates
- Candidate-evidence / partial-drift diagnostic expansions unrelated to active blocker
- Plan-only lifecycle or reconcile artifact additions
- New quality gates not required for milestone smoke
- Readiness percentage updates
- Claiming pass without evidence in the milestone evidence folder

## Allowed infra examples (when tied to M1)

- Minimal exact drift/live coherence so preview **link** or **validate --live** can pass for Clerk/Vercel/Convex preview only
- Ledger rows + link/adopt for real preview resources
- Clerk sign-in wiring in generated web app
- One protected Convex path consumed from web
- Smoke script + redacted evidence capture
- Ledger-gated Convex apply + Vercel preview deploy apply (already partially exist)

## File layout

```
docs/
  validation-hypothesis.md      # North star
  validation-operating-model.md # This file
  milestones/
    README.md
    M1-preview-e2e.md           # Active milestone
    M2-agent-completes-m1.md    # Next (locked until M1)
    THREAD-KICKOFF.md           # Copy-paste thread prompts
    evidence/
      M1-preview-e2e/           # Redacted logs, smoke output, runbook
```
