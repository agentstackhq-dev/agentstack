# M1 Preview E2E — Evidence

Redacted artifacts from spike, unblock, and runtime threads for [M1](../../M1-preview-e2e.md).

## What to store here

- `spike-log.md` — spike thread findings, friction notes, gap list
- `runbook.md` — exact command sequence that worked (secrets redacted)
- `smoke-output.txt` — redacted PASS output or marker-missing blocker output from `pnpm run m1:preview:smoke` after the same URL has matching top-level PASS deploy evidence
- `deploy-url.txt` — preview URL emitted by `m1:preview:deploy`; `m1:preview:smoke` may refresh it only after matching deploy evidence exists
- `deploy-output.txt` — redacted deploy-helper output from `pnpm run m1:preview:deploy -- --confirm-live-mutation`
- `m1:evidence:check` output — local redacted evidence-bundle validation, not provider readiness
- `m1-live-preview-pass-*.md` — redacted final live pass summary for the generated app path
- `workflow-guidance-*.md` — generated guidance fixes that keep M1 live evidence distinct from local preview rehearsal output
- `provider-ledger-replace-*.md` — ledger repair support for replacing `pending` planned rows with real provider ids or dashboard URLs
- `m1-ledger-pending-guard-*.md` — generated helper guardrails that keep implicit `pending` rows from looking like real Ledger progress
- `m1-ledger-replace-helper-*.md` — generated M1 helper support for replacing all explicit pending rows with real active rows
- `m1-ledger-rollback-*.md` — generated M1 helper support for restoring ledger and evidence files after partial ledger-record failure
- `m1-evidence-active-ledger-gate-*.md` — generated evidence-check support for requiring active real M1 ledger rows
- `m1-provider-link-active-ledger-gate-*.md` — generated provider-link support for refusing planned rows before local link mutation
- `m1-provider-link-evidence-*.md` — generated provider-link helper support for preserving redacted Connect evidence
- `m1-provider-link-rollback-*.md` — generated provider-link helper support for restoring prior local link state after partial link failure
- `m1-provider-link-stale-evidence-cleanup-*.md` — generated provider-link helper support for removing stale `provider-links.txt` after partial link failure
- `m1-preview-deploy-provider-link-gate-*.md` — generated deploy-helper support for refusing deploy before local provider-link state and evidence exist
- `m1-preview-deploy-provider-link-top-level-result-gate-*.md` — generated deploy-helper support for refusing failed provider-link evidence whose notes merely mention `Result: PASS`
- `m1-preview-deploy-active-ledger-gate-*.md` — generated deploy-helper support for refusing planned rows before provider execution
- `m1-preview-deploy-failure-evidence-*.md` — generated deploy-helper support for preserving redacted failed-stage blocker evidence
- `m1-preview-deploy-stale-url-cleanup-*.md` — generated deploy-helper support for removing stale deploy URL evidence when provider execution starts and then fails
- `m1-preview-deploy-smoke-invalidation-*.md` — generated deploy-helper support for removing stale Auth/Data smoke evidence when provider execution starts
- `m1-preview-smoke-failure-evidence-*.md` — generated smoke-helper support for preserving redacted marker-failure blocker evidence
- `m1-preview-smoke-deploy-evidence-gate-*.md` — generated smoke-helper support for refusing synthetic Auth/Data smoke evidence unless PASS deploy evidence matches the same URL
- `m1-preview-smoke-top-level-deploy-result-gate-*.md` — generated smoke-helper support for refusing failed deploy evidence whose notes merely mention `Result: PASS`
- `m1-preview-smoke-dom-source-redaction-*.md` — generated smoke-helper support for redacting local DOM snapshot file paths from smoke evidence
- `m1-preview-smoke-stdout-redaction-*.md` — generated smoke-helper support for relative local mutation summaries instead of helper-owned absolute output paths
- `m1-evidence-url-coherence-*.md` — generated evidence-check support for rejecting bundles where deploy and smoke evidence name different preview URLs
- `m1-evidence-provider-link-state-*.md` — generated evidence-check support for requiring local provider-link state alongside redacted Connect evidence
- `m1-evidence-runbook-placeholder-gate-*.md` — generated evidence-check support for rejecting scaffold runbook placeholders before Evidence can pass
- `m1-evidence-runbook-result-gate-*.md` — generated evidence-check support for rejecting failed/not-run runbook steps and non-pass final checkbox reviews
- `m1-evidence-runbook-final-checkbox-presence-gate-*.md` — generated evidence-check support for rejecting missing final M1 checkbox review lines
- `m1-evidence-smoke-timestamp-order-*.md` — generated evidence-check support for rejecting smoke evidence captured before deploy evidence
- `m1-evidence-top-level-result-gate-*.md` — generated evidence-check support for requiring top-level PASS results in provider-link, deploy, and smoke evidence
- `m1-runbook-provider-link-evidence-placement-*.md` — generated runbook support for placing `provider-links.txt` under the provider-link step
- Screenshots optional; redact IDs and secrets

## What not to store

- Raw API keys, Clerk secrets, Convex deploy keys, Vercel tokens
- Full provider CLI stdout with identifiers
- Unredacted ledger rows with real external IDs (summarize instead)

## Ledger

Real resources must also be recorded in [docs/provider-resource-ledger.md](../../../provider-resource-ledger.md).
