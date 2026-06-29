# Agentstack Validation Hypothesis

Date: 2026-06-22
Updated: 2026-06-29

This document is the north star for Agentstack work. Active execution lives in `docs/milestones/`. The consumer production readiness roadmap is backlog reference only.

## Core bet

An agent-first meta-framework can take a developer or coding agent from zero to a working B2B SaaS **preview** using a lean generated app plus an installed Agentstack package that owns provider glue, guidance, validation, diagnostics, and evidence commands.

Post-M1 correction result: M1 proved the provider path could work, but the generated consumer surface was wrong. The
lean correction is now verified through M2: Agentstack is a package dependency, not copied framework internals. The
generated app exposes app code, `AGENTS.md`, `package.json`, `.gitignore`, and a typed `agentstack.config.ts`; deeper
framework knowledge must come from package-owned CLI/docs so guidance does not go stale. `pnpm-workspace.yaml` is part
of the lean root because pnpm and TypeScript language servers require workspace metadata for app package resolution. M3
has also proved one Clerk Billing webhook and entitlement path without violating that lean boundary. M4 then proved the
local package-installability path with packed Agentstack artifacts in a clean temp consumer workspace.

## What would validate the bet (v0)

One person or agent completes the following using **only** the lean generated app, installed Agentstack package commands, package-owned Agentstack guidance, and provider CLI auth handoffs:

1. Generate an app from the B2B SaaS template with `agentstack create <app-name>` and the corrected lean root surface
2. Validate typed `agentstack.config.ts` through the installed Agentstack package schema with `pnpm run validate`
3. Check the local web surface start path with `pnpm run dev:check`, then use `pnpm run dev` for long-running local work
4. Run `pnpm run preview:up -- --confirm-live-mutation` to create/reuse, ledger, link, and deploy preview Clerk, Convex, and Vercel resources through package-owned Agentstack commands
6. Run a package-owned Agentstack command so the Clerk smoke user lifecycle is repeatable and ledgered
7. Sign in with Clerk on that URL
8. Call one protected Convex query/mutation as the signed-in user
9. Produce redacted evidence in the Agentstack framework repo, not as generated consumer-app docs
10. For the first SaaS-spine extension, configure Clerk Billing, receive a real Billing webhook in Convex, and gate
    `feature.auditLog` through package-owned commands and evidence

Success means the framework makes contact with real provider state and orchestrates the path. Provider login links, browser auth, and one-time account/project selection are acceptable handoffs when the CLI requires them; undocumented dashboard setup or manual resource transcription is not.

## What would falsify the bet

- Package-owned guidance does not match real commands or provider behavior
- Package-owned provider bootstrap cannot create/reuse, ledger, and configure the preview provider resources after required CLI auth/account selection
- Completing preview requires significant steps not covered by Agentstack package commands or package-owned guidance
- Validation gates miss real failures or falsely pass rehearsal state
- Framework overhead exceeds value vs a plain template + manual provider setup
- An agent cannot complete M2 from the lean generated app without human intervention beyond provider auth/account-selection handoffs
- Repeating M3 Billing requires ad hoc manual Clerk API/dashboard work that is not captured by package commands or a
  precise provider handoff

## Current boundary

M1 and M2 are complete. M3 has a live pass with cleanup pending. M4 is complete as a local-pack clean-machine smoke.

Out of scope until explicitly started after M4:

- Public npm publish and release automation
- Production release gates and production payment setup
- Hosted control plane
- EAS mobile builds and mobile billing surfaces
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

## Current evidence state

- M1 passed on 2026-06-28 as a provider-path spike.
- M2 passed on 2026-06-28 as the corrected lean generated-app and package-owned CLI proof.
- M3 live billing passed on 2026-06-29 with Clerk Billing, a Convex webhook, allowed/denied web smoke, replay
  idempotency, and package-owned subscribe evidence.
- Remaining M3 work is cleanup/revert of retained smoke billing resources, not new product scope.
- M4 local-pack clean-machine smoke passed on 2026-06-29 with packed `agentstack` artifacts, generated app install,
  `validate`, `dev:check`, and the live-preview confirmation gate.

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
| `docs/milestones/M3-billing-webhook.md` | Clerk Billing webhook and entitlement live pass state |
| `docs/references/m3-clerk-billing-fixture.md` | Repeatable billing fixture and payment-method handoff |
| `docs/validation-operating-model.md` | How we run spike / unblock / runtime threads |
| `docs/consumer-production-readiness-roadmap.md` | Backlog capability matrix (not active task list) |
| `docs/consumer-production-readiness-progress.md` | **Archived** slice log — do not extend |
| `docs/provider-resource-ledger.md` | Required for any real external resource |
