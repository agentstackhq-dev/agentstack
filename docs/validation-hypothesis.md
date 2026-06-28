# Agentstack Validation Hypothesis

Date: 2026-06-22

This document is the north star for Agentstack work. Active execution lives in `docs/milestones/`. The consumer production readiness roadmap is backlog reference only.

## Core bet

An agent-first meta-framework can take a developer or coding agent from zero to a working B2B SaaS **preview** using a lean generated app plus an installed Agentstack package that owns provider glue, guidance, validation, diagnostics, and evidence commands.

Post-M1 correction result: M1 proved the provider path could work, but the generated consumer surface was wrong. The lean correction is now verified: Agentstack is a package dependency, not copied framework internals. The generated app exposes app code, `AGENTS.md`, `package.json`, `.gitignore`, and a typed `agentstack.config.ts`; deeper framework knowledge must come from package-owned CLI/docs so guidance does not go stale.

## What would validate the bet (v0)

One person or agent completes the following using **only** the lean generated app, installed Agentstack package commands, package-owned Agentstack guidance, and provider CLI auth handoffs:

1. Generate an app from the B2B SaaS template with `agentstack create <app-name>` and the corrected lean root surface
2. Validate typed `agentstack.config.ts` through the installed Agentstack package schema
3. Run package-owned Agentstack commands to create/reuse, ledger, and locally configure preview Clerk, Convex, and Vercel resources
4. Run package-owned Agentstack commands to link provider resources
5. Deploy the web app to a Vercel preview URL through package-owned Agentstack commands
6. Run a package-owned Agentstack command so the Clerk smoke user lifecycle is repeatable and ledgered
7. Sign in with Clerk on that URL
8. Call one protected Convex query/mutation as the signed-in user
9. Produce redacted evidence in the Agentstack framework repo, not as generated consumer-app docs

Success means the framework makes contact with real provider state and orchestrates the path. Provider login links, browser auth, and one-time account/project selection are acceptable handoffs when the CLI requires them; undocumented dashboard setup or manual resource transcription is not.

## What would falsify the bet

- Package-owned guidance does not match real commands or provider behavior
- Package-owned provider bootstrap cannot create/reuse, ledger, and configure the preview provider resources after required CLI auth/account selection
- Completing preview requires significant steps not covered by Agentstack package commands or package-owned guidance
- Validation gates miss real failures or falsely pass rehearsal state
- Framework overhead exceeds value vs a plain template + manual provider setup
- An agent cannot complete M2 from the lean generated app without human intervention beyond provider auth/account-selection handoffs

## Out of scope until the corrected lean preview path passes

- Production release gates, hosted control plane, EAS mobile builds
- Billing, webhooks, entitlements (M3)
- Public npm publish and clean-machine install (M4)
- Broad exact proof for all providers × all environments
- New diagnostic-only CLI surfaces that do not unblock E2E
- Percentage-based readiness estimates as a progress metric

## Kill / pivot criteria

If the corrected lean preview path is not reachable through the package-owned bootstrap/link/deploy/smoke path within **3–5 focused milestone threads** (spike + unblock cycles), stop expanding infra and decide:

- **Pivot:** thinner template + docs without meta-framework control plane
- **Narrow:** meta-framework for validation/docs only, not provider orchestration
- **Continue:** only with a named blocker and explicit owner-provided credentials/resources

Record the decision in the active milestone card.

## Milestone ladder

| ID | Name | Validates |
| --- | --- | --- |
| M1 | Preview E2E | Meta-framework can orchestrate preview web + auth + Convex |
| M2 | Agent completes lean preview | Agent-first claim with lean app surface, typed config schema, and package-owned CLI guidance |
| M3 | Billing webhook + entitlement | SaaS spine beyond auth |
| M4 | Clean-machine smoke | Consumer packaging |

See `docs/milestones/` for active cards and acceptance criteria.

## Infra litmus test

Infra work is allowed when it **directly unblocks** the active milestone's next acceptance checkbox.

Ask before implementing:

> If this ships, does lean generation, typed `agentstack.config.ts`, package-owned provider bootstrap/link/deploy, package-owned smoke, or package-owned evidence get closer to PASS, or does it only make refusal/diagnostics more precise?

If the answer is "more precise refusal only," defer it unless it is the **single** known blocker for link, deploy, auth, or smoke.

## Related docs

| Doc | Role |
| --- | --- |
| `docs/milestones/M1-preview-e2e.md` | Completed provider-path spike and post-pass findings |
| `docs/milestones/M2-agent-completes-m1.md` | Corrected lean generated-surface contract for the next validation milestone |
| `docs/validation-operating-model.md` | How we run spike / unblock / runtime threads |
| `docs/consumer-production-readiness-roadmap.md` | Backlog capability matrix (not active task list) |
| `docs/consumer-production-readiness-progress.md` | **Archived** slice log — do not extend |
| `docs/provider-resource-ledger.md` | Required for any real external resource |
