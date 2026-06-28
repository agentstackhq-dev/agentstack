# Ledger Evidence Writer - 2026-06-22

Target checkbox: Ledger

Status: support path improved; checkbox remains open until real preview Clerk, Convex, and Vercel rows are recorded.

## What Changed

- Added `--write-evidence` to `agentstack provider ledger record`.
- The flag writes a redacted markdown evidence note under `docs/milestones/evidence/`.
- The command still performs no provider CLI calls and writes no telemetry.
- Evidence paths are constrained to local milestone markdown files and must not already exist.
- Generated M1 docs now use service-specific evidence files for Clerk, Convex, and Vercel.

## Redacted Verification

Focused command:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "writes redacted provider ledger evidence when requested"
```

Result: pass.

Assertions covered:

- `docs/provider-resource-ledger.md` is updated locally.
- A redacted evidence note is written at the requested milestone evidence path.
- CLI output does not include the raw external id/url.
- The evidence note does not include the raw external id/url.
- No provider executor runs.
- `.agentstack/events.jsonl` is not written.

## Blocker

Real M1 preview provider resources still need operator-specific owner/account values and ledger rows before link, inspect, apply, or deploy.
