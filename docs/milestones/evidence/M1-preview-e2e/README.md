# M1 Preview E2E — Evidence

Redacted artifacts from spike, unblock, and runtime threads for [M1](../../M1-preview-e2e.md).

## What to store here

- `spike-log.md` — spike thread findings, friction notes, gap list
- `runbook.md` — exact command sequence that worked (secrets redacted)
- `smoke-output.txt` — HTTP smoke, auth check notes (no tokens)
- `deploy-url.txt` — preview URL (ok to store; no auth cookies)
- Screenshots optional; redact IDs and secrets

## What not to store

- Raw API keys, Clerk secrets, Convex deploy keys, Vercel tokens
- Full provider CLI stdout with identifiers
- Unredacted ledger rows with real external IDs (summarize instead)

## Ledger

Real resources must also be recorded in [docs/provider-resource-ledger.md](../../../provider-resource-ledger.md).
