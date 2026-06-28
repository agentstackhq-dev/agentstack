# Agent Rules

## Current singular goal

M2 approach discussion is the only active goal: the lean generated-surface correction is implemented and verified, and the live M2 preview loop must not start until the package-owned provider/auth/evidence approach is agreed.

M1 is complete as a provider-path spike. It proved that Clerk, Convex, and Vercel preview orchestration can work, but it also exposed the wrong generated consumer shape. Do not keep extending the old generated-docs/generated-scripts M1 path.

The corrected product contract is:

- `agentstack create <app-name>` is the consumer entrypoint for generating an ultra-lean app root: `apps/mobile`, `apps/web`, `apps/convex`, `agentstack.config.ts`, `AGENTS.md`, `.gitignore`, and `package.json`.
- `agentstack.config.ts` is mandatory, fully typed, and schema-driven from the installed Agentstack package.
- Agentstack is a package dependency and CLI, not copied framework internals inside the generated app.
- Package-owned CLI/docs/help own provider glue, validation, diagnostics, evidence, and runbooks.
- M2 proof work must invoke the public `agentstack` bin and generated app package scripts. Do not use direct imports of `generateProject`, `runAgentstack`, provider helpers, or telemetry helpers as the success path.
- Generated consumer apps must not include copied `docs/`, copied `scripts/`, generated skills, generated provider ledger source files, root `convex/`, `vercel.json`, or copied M1 runbooks.
- Ignored `.agentstack/` state may hold provider links, evidence, auth fixtures, ledgers, deploy metadata, and smoke artifacts.

Do not start the fresh-agent M2 preview attempt yet.

## Where to start

Validation-first work uses milestones, not open-ended readiness expansion.

1. Read `docs/validation-hypothesis.md`
2. Read `docs/milestones/README.md`
3. Read `docs/milestones/M2-agent-completes-m1.md`
4. Read `docs/validation-operating-model.md` when scope is unclear

`docs/consumer-production-readiness-roadmap.md` is backlog reference. `docs/consumer-production-readiness-progress.md` is **archived** — do not extend it slice-by-slice.

## Validation-first work mode

- Optimize for the agreed **M2** package-owned preview path, not diagnostic coverage or readiness percentages.
- Before coding, state which M2 checkbox or correction-loop requirement this session targets.
- Infra is allowed when it **directly unblocks** that checkbox for the active milestone (see infra litmus test in `docs/validation-hypothesis.md`).
- Forbidden by default: adding copied docs/scripts/skills to generated apps, new diagnostic-only CLI surfaces, candidate-evidence / partial-drift slices, plan-only reconcile expansions, quality-gate additions unrelated to the milestone, progress-log churn, and more documentation that does not change package-owned CLI behavior.
- Session output must include: checkbox progress (pass/fail/unchanged), redacted evidence or explicit blocker, smallest next step.
- Update the active milestone card in `docs/milestones/`. Append evidence under `docs/milestones/evidence/<milestone-id>/`.
- Ledger every real external resource per `docs/provider-resource-ledger.md` before create/link/mutate.
- Provider CLI installation and authentication remain part of live-provider work. Install missing CLIs through package-owned Agentstack dependencies or local package manager. If provider auth needs a browser/login link or interactive account selection, run the CLI until it prints the exact action the user must take, report that action, then resume from the same command after auth.
- Do not stop at "provider inputs needed" when a package-owned CLI can discover, create, or link the resource.
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
