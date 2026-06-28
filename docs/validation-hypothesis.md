# Agentstack Validation Hypothesis

Date: 2026-06-22

This document is the north star for Agentstack work. Active execution lives in `docs/milestones/`. The consumer production readiness roadmap is backlog reference only.

## Core bet

An agent-first meta-framework can take a developer or coding agent from zero to a working B2B SaaS **preview** using generated code, generated docs/skills, and executable package scripts. For M1, the bet is concrete: `m1:providers:bootstrap` can create or reuse real Clerk, Convex, and Vercel preview resources, ledger them, and leave the generated app ready for link, deploy, auth, data, and evidence.

## What would validate the bet (v0)

One person or agent completes the following using **only** generated Agentstack docs, skills, package scripts, and provider CLI auth handoffs:

1. Generate an app from the B2B SaaS template
2. Run `pnpm run m1:providers:bootstrap -- --confirm-live-mutation` to create/reuse, ledger, and locally configure preview Clerk, Convex, and Vercel resources
3. Run `pnpm run m1:providers:link`
4. Deploy the web app to a Vercel preview URL through `pnpm run m1:preview:deploy -- --confirm-live-mutation`
5. Run `pnpm run m1:auth:user -- ensure --confirm-live-mutation` so the Clerk smoke user lifecycle is repeatable and ledgered
6. Sign in with Clerk on that URL
7. Call one protected Convex query/mutation as the signed-in user
8. Produce a redacted evidence bundle under `docs/milestones/evidence/M1-preview-e2e/`

Success means the framework makes contact with real provider state and orchestrates the path. Provider login links, browser auth, and one-time account/project selection are acceptable handoffs when the CLI requires them; undocumented dashboard setup or manual resource transcription is not.

## What would falsify the bet

- Generated guidance does not match real commands or provider behavior
- `m1:providers:bootstrap` cannot create/reuse, ledger, and configure the M1 provider resources after required CLI auth/account selection
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

If **M1** is not reachable through the executable bootstrap/link/deploy/smoke path within **3–5 focused milestone threads** (spike + unblock cycles), stop expanding infra and decide:

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

> If this ships, does `m1:providers:bootstrap`, `m1:providers:link`, `m1:preview:deploy`, `m1:preview:smoke`, or `m1:evidence:check` get closer to PASS, or does it only make refusal/diagnostics more precise?

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
