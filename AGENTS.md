# Agent Rules

## Where to start

Validation-first work uses milestones, not open-ended readiness expansion.

1. Read `docs/validation-hypothesis.md`
2. Read the active milestone in `docs/milestones/` (currently **M1**: `docs/milestones/M1-preview-e2e.md`)
3. Read `docs/validation-operating-model.md` when scope is unclear

`docs/consumer-production-readiness-roadmap.md` is backlog reference. `docs/consumer-production-readiness-progress.md` is **archived** — do not extend it slice-by-slice.

## Validation-first work mode

- Optimize for the **active milestone acceptance checkboxes**, not diagnostic coverage or readiness percentages.
- Before coding, state which milestone checkbox this session targets.
- Infra is allowed when it **directly unblocks** that checkbox for the active milestone (see infra litmus test in `docs/validation-hypothesis.md`).
- Forbidden by default: new diagnostic-only CLI surfaces, candidate-evidence / partial-drift slices, plan-only reconcile expansions, quality-gate additions unrelated to the milestone, progress-log churn.
- Session output must include: checkbox progress (pass/fail/unchanged), redacted evidence or explicit blocker, smallest next step.
- Update the active milestone card in `docs/milestones/`. Append evidence under `docs/milestones/evidence/<milestone-id>/`.
- Ledger every real external resource per `docs/provider-resource-ledger.md` before create/link/mutate.

## Green-field rules

- This repository is green-field. There are no pre-existing Agentstack users, installations, or public compatibility contracts.
- Do not add legacy support, backward-compatibility fallbacks, dual old/new code paths, migration shims, deprecated aliases, or "support older versions" behavior unless the user explicitly approves it for a named reason.
- When a design changes, replace the old path coherently across code, templates, docs, tests, and generated guidance. Do not preserve the old path just in case.
- Treat compatibility code as tech debt by default. If you believe compatibility is required, stop and ask before implementing it.
- Keep generated templates, package-local template mirrors, docs, tests, and validation gates aligned in the same change.
- Treat live provider inventory identity as ambiguous unless exact proof is explicitly implemented; sanitized `missing=` labels and `Identity proof requirements:` summaries are blockers, not identity matches.
- Run the focused tests for the files you changed, then run `pnpm typecheck` and `pnpm test` before finalizing framework changes.
