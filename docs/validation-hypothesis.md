# Agentstack Validation Hypothesis

Date: 2026-06-22

This document is the north star for Agentstack work. Active execution lives in `docs/milestones/`. The consumer production readiness roadmap is backlog reference only.

## Core bet

An agent-first meta-framework can take a developer (or coding agent) from zero to a working B2B SaaS **preview** using `agentstack.config.json`, generated docs/skills, and CLI gates — with **less manual provider coordination** than setting up Next/Convex/Clerk/Vercel by hand.

## What would validate the bet (v0)

One person or agent completes the following using **only** generated Agentstack docs, skills, and CLI commands (no undocumented provider dashboard steps):

1. Generate an app from the B2B SaaS template
2. Ledger and connect preview Clerk, Convex, and Vercel resources
3. Deploy the web app to a Vercel preview URL
4. Sign in with Clerk on that URL
5. Call one protected Convex query/mutation as the signed-in user
6. Produce a redacted evidence bundle under `docs/milestones/evidence/M1-preview-e2e/`

Success means the framework **orchestrated** the path, not that every provider surface is fully automated.

## What would falsify the bet

- Generated guidance does not match real commands or provider behavior
- Completing preview requires significant steps not covered by generated docs/skills
- Validation gates miss real failures or falsely pass rehearsal state
- Framework overhead exceeds value vs a plain template + manual provider setup
- An agent cannot complete M2 (same path with skills only) without human provider intervention

## Out of scope until M1 passes

- Production release gates, hosted control plane, EAS mobile builds
- Billing, webhooks, entitlements (M3)
- Public npm publish and clean-machine install (M4)
- Broad exact proof for all providers × all environments
- New diagnostic-only CLI surfaces that do not unblock E2E
- Percentage-based readiness estimates as a progress metric

## Kill / pivot criteria

If **M1** is not reachable within **3–5 focused milestone threads** (spike + unblock cycles), stop expanding infra and decide:

- **Pivot:** thinner template + docs without meta-framework control plane
- **Narrow:** meta-framework for validation/docs only, not provider orchestration
- **Continue:** only with a named blocker and explicit owner-provided credentials/resources

Record the decision in the active milestone card.

## Milestone ladder

| ID | Name | Validates |
| --- | --- | --- |
| M1 | Preview E2E | Meta-framework can orchestrate preview web + auth + Convex |
| M2 | Agent completes M1 | Agent-first claim (skills + CLI only) |
| M3 | Billing webhook + entitlement | SaaS spine beyond auth |
| M4 | Clean-machine smoke | Consumer packaging |

See `docs/milestones/` for active cards and acceptance criteria.

## Infra litmus test

Infra work is allowed when it **directly unblocks** the active milestone's next acceptance checkbox.

Ask before implementing:

> If this ships, does the active milestone get closer to PASS, or does it only make refusal/diagnostics more precise?

If the answer is "more precise refusal only," defer it unless it is the **single** known blocker for link, deploy, auth, or smoke.

## Related docs

| Doc | Role |
| --- | --- |
| `docs/milestones/M1-preview-e2e.md` | Active milestone (start here for coding agents) |
| `docs/milestones/THREAD-KICKOFF.md` | Copy-paste prompts for new threads |
| `docs/validation-operating-model.md` | How we run spike / unblock / runtime threads |
| `docs/consumer-production-readiness-roadmap.md` | Backlog capability matrix (not active task list) |
| `docs/consumer-production-readiness-progress.md` | **Archived** slice log — do not extend |
| `docs/provider-resource-ledger.md` | Required for any real external resource |
