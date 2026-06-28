# M1 Ledger Helper - 2026-06-22

Target checkbox: Ledger

Status: support path improved; checkbox remains open until real preview Clerk, Convex, and Vercel resources are recorded.

## What Changed

- Added generated `scripts/m1-ledger-record.mjs`.
- Added package script `m1:ledger:record`.
- The helper records the M1 Clerk application, Convex deployment, and Vercel project rows in one local-only pass.
- Optional external IDs are read from `M1_CLERK_EXTERNAL_ID`, `M1_CONVEX_EXTERNAL_ID`, and `M1_VERCEL_EXTERNAL_ID` instead of command-line flags, because `pnpm run` prints argv before the script can redact.
- The helper calls the existing `provider ledger record --write-evidence` command for each row, preserving ledger validation and redacted evidence behavior.

Current behavior was tightened later on 2026-06-22: missing `M1_*_EXTERNAL_ID` values now fail before mutation unless `--allow-pending` is passed for explicit pre-creation planned rows. See [m1-ledger-pending-guard-2026-06-22.md](./m1-ledger-pending-guard-2026-06-22.md).

## Redacted Verification

Focused commands:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Result: pass.

Assertions covered:

- A generated app exposes `m1:ledger:record`.
- The helper records Clerk, Convex, and Vercel preview rows with service-specific evidence files.
- Raw external IDs supplied through environment variables are present in `docs/provider-resource-ledger.md` but absent from command output and evidence notes.
- The helper does not append telemetry.
- Generated docs mention `m1:ledger:record` and the `M1_*_EXTERNAL_ID` variables.

## Blocker

No real provider rows were recorded in the root Agentstack ledger. The next acceptance step still needs real owner/account/resource values for preview Clerk, Convex, and Vercel.
