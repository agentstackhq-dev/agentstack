# Agent Rules

## Current singular goal

M5 preview beta publishability passed on 2026-06-30. The approved package contract is `@agentstackhq/agentstack` as the
public npm facade while preserving the `agentstack` CLI binary. The usable beta line is `0.1.0-beta.3`; both `beta` and
`latest` npm dist-tags point to that version for `@agentstackhq/core`, `@agentstackhq/telemetry`,
`@agentstackhq/adapters`, `@agentstackhq/cli`, and `@agentstackhq/agentstack`. A fresh public-registry install can run
`agentstack create`, install the generated app, run generated app `typecheck`, `validate`, `dev:check`, web build, and
hit the preview live-mutation confirmation gate. Start from `docs/milestones/M5-preview-beta-publishability.md`,
`docs/milestones/evidence/M5-preview-beta-publishability/m5-local-preview-release-check-2026-06-30.md`, and
`docs/milestones/evidence/M5-preview-beta-publishability/m5-npm-beta-registry-smoke-2026-06-30.md`.

Release automation is now package-owned. Future npm publishes must follow
`docs/releases/versioning-and-release-workflow.md`: bump the lockstep package version with `release:bump`, run
`release:check`, and publish through `.github/workflows/release.yml` using npm Trusted publishing and the
`npm-production` GitHub environment. Do not publish new versions through ad hoc local token commands unless the user
explicitly approves an emergency recovery path.

M4 local-pack clean-machine smoke passed on 2026-06-29. The framework can pack the local Agentstack workspace packages,
install the packed public package into a clean temp consumer workspace, run the packed `agentstack` bin to generate a lean
app, install the generated app from tarball specs plus `pnpm.overrides`, and run generated app `validate` plus
`dev:check` without monorepo source `link:` dependencies.

M3 live Clerk Billing also passed on 2026-06-29. Clerk Billing was enabled, the `audit_log` feature and
`agentstack_m3_audit_log` plan were present, the Convex webhook was configured, a Clerk test payment source was added
through the live preview Clerk browser SDK, the smoke user was subscribed to the configured plan, Convex processed the
real Billing webhook, allowed UI smoke passed, Svix replay idempotency passed, and M3 evidence check passed. Start from
`docs/milestones/evidence/M3-billing-webhook/m3-live-billing-check-2026-06-29.md` and
`docs/references/m3-clerk-billing-fixture.md` for live billing cleanup or repeatability work.

M1 is complete as a provider-path spike. It proved that Clerk, Convex, and Vercel preview orchestration can work, but it also exposed the wrong generated consumer shape. Do not keep extending the old generated-docs/generated-scripts M1 path.

M2 is complete as the lean generated-surface proof. It proved a fresh consumer app can run preview provider bootstrap,
link, deploy, auth fixture, smoke, and evidence through the installed Agentstack package and generated package scripts.
M3 and M4 preserve that product boundary.

The corrected product contract is:

- `agentstack create <app-name>` is the consumer entrypoint for generating an ultra-lean app root: `apps/mobile`, `apps/web`, `apps/convex`, `agentstack.config.ts`, `AGENTS.md`, `.gitignore`, `package.json`, and `pnpm-workspace.yaml`.
- `agentstack.config.ts` is mandatory, fully typed, and schema-driven from the installed Agentstack package.
- Agentstack is a package dependency and CLI, not copied framework internals inside the generated app.
- Package-owned CLI/docs/help own provider glue, validation, diagnostics, evidence, and runbooks.
- M3/M4/M5 proof work must invoke the public `agentstack` bin and generated app package scripts. Do not use direct imports of `generateProject`, `runAgentstack`, provider helpers, or telemetry helpers as the success path.
- Generated consumer apps must not include copied `docs/`, copied `scripts/`, generated skills, generated provider ledger source files, root `convex/`, `vercel.json`, or copied M1 runbooks.
- Ignored `.agentstack/` state may hold provider links, evidence, auth fixtures, ledgers, deploy metadata, and smoke artifacts.
- Clerk Billing webhooks for M3 should target a Convex HTTP action on the preview `.convex.site` URL, not a Vercel preview URL.
- `feature.auditLog` is the M3 entitlement key. Provider-specific Clerk plan/feature slugs must come from typed `agentstack.config.ts`.
- M4 local-pack smoke uses `corepack pnpm run m4:pack:smoke` from the framework repo. It may pack internal workspace
  packages into temp tarballs and use generated-app `pnpm.overrides`, but the generated app must expose only
  `@agentstackhq/agentstack` as a direct framework dependency.
- M5 local release check uses `corepack pnpm run m5:release:check`. It is a pre-publish gate; M5 completion requires a
  fresh registry install of `@agentstackhq/agentstack@beta` without local tarball overrides.
- New release work uses `corepack pnpm run release:check`, `corepack pnpm run release:publish -- --tag beta --dry-run`,
  and the manual GitHub release workflow. The release contract enforces lockstep versions, registry-safe internal
  dependencies, generated template version alignment, and no legacy package scope in current surfaces.

Do not start hosted control-plane work, production-gate work, EAS/mobile live proof, or broad provider matrix work without
an explicit approach discussion.

## Where to start

Validation-first work uses milestones, not open-ended readiness expansion.

1. Read `README.md`
2. Read `docs/README.md`
3. Read `ARCHITECTURE.md`
4. Read `docs/validation-hypothesis.md`
5. Read `docs/milestones/README.md`
6. Read `docs/milestones/M5-preview-beta-publishability.md`
7. Read `docs/releases/versioning-and-release-workflow.md` before touching release/package publication work
8. Read `docs/milestones/M4-clean-machine-smoke.md`
9. Read `docs/milestones/M3-billing-webhook.md` and `docs/references/m3-clerk-billing-fixture.md` before touching live billing
10. Read `docs/validation-operating-model.md` when scope is unclear

`docs/consumer-production-readiness-roadmap.md` is backlog reference. `docs/consumer-production-readiness-progress.md` is **archived** - do not extend it slice-by-slice.

## Validation-first work mode

- Optimize for milestone acceptance criteria, not diagnostic coverage or readiness percentages.
- Before coding, state which milestone checkbox or plan task this session targets.
- Infra is allowed when it **directly unblocks** that checkbox for the active milestone (see infra litmus test in `docs/validation-hypothesis.md`).
- Forbidden by default: adding copied docs/scripts/skills to generated apps, new diagnostic-only CLI surfaces, candidate-evidence / partial-drift slices, plan-only reconcile expansions, quality-gate additions unrelated to the milestone, progress-log churn, and more documentation that does not change package-owned CLI behavior.
- Session output must include: checkbox progress (pass/fail/unchanged), redacted evidence or explicit blocker, smallest next step.
- Update the active milestone card in `docs/milestones/`. Append evidence under `docs/milestones/evidence/<milestone-id>/`.
- Ledger every real external resource per `docs/provider-resource-ledger.md` before create/link/mutate.
- Provider CLI installation and authentication remain part of live-provider work. Install missing CLIs through package-owned Agentstack dependencies or local package manager. If provider auth needs a browser/login link or interactive account selection, run the CLI until it prints the exact action the user must take, report that action, then resume from the same command after auth.
- Do not stop at "provider inputs needed" when a package-owned CLI can discover, create, or link the resource.
- Clerk Billing smoke-user, smoke-organization, subscription fixture, entitlement, and cleanup lifecycle are part of M3.
  Use package-owned M3 billing commands instead of manual Clerk dashboard/API patching, except for exact provider
  handoffs printed by those commands. The repeatable subscription path is
  `pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation`; if it
  reports that a payment method is required, follow the Clerk browser SDK handoff documented in
  `docs/references/m3-clerk-billing-fixture.md`, then rerun the subscribe command.
- Planned or pending ledger rows are blockers, not progress toward checked acceptance boxes, until the package-owned bootstrap or repair path records active real resource identities.

## Green-field rules

- This repository is green-field. There are no pre-existing Agentstack users, installations, or public compatibility contracts.
- Do not add legacy support, backward-compatibility fallbacks, dual old/new code paths, migration shims, deprecated aliases, or "support older versions" behavior unless the user explicitly approves it for a named reason.
- When a design changes, replace the old path coherently across code, templates, docs, tests, and generated guidance. Do not preserve the old path just in case.
- Treat compatibility code as tech debt by default. If you believe compatibility is required, stop and ask before implementing it.
- Keep generated templates, package-local template mirrors, docs, tests, and validation gates aligned in the same change.
- When removing the old generated-docs/generated-scripts path, replace it coherently. Do not preserve copied M1 scripts or generated framework docs as compatibility fallbacks.
- Treat live provider inventory identity as ambiguous unless exact proof is explicitly implemented; sanitized `missing=` labels and `Identity proof requirements:` summaries are blockers, not identity matches.
- Run the focused tests for the files you changed, then run `pnpm typecheck` and `pnpm test` before finalizing framework changes.
