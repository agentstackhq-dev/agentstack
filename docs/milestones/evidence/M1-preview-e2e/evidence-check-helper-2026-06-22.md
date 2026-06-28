# M1 Evidence Check Helper Evidence

Date: 2026-06-22

Milestone checkbox targeted: Evidence support for the real M1 provider run.

Result: generated evidence checker support PASS; M1 real acceptance unchanged because no real provider resources were ledgered, linked, deployed, or smoked.

Change:

- Added `pnpm run m1:evidence:check` to both generated template mirrors.
- The helper checks the local redacted M1 evidence bundle only:
  - provider ledger rows for Clerk, Convex, and Vercel preview resources
  - service-specific provider-ledger evidence notes
  - `deploy-url.txt`
  - `deploy-output.txt`
  - `smoke-output.txt`
  - `runbook.md`
- The helper refuses when the runbook still says `Status: not run`.
- The helper prints sanitized labels only and does not call provider CLIs, mutate provider resources, write local state, or append telemetry.

Verification:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts"
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
pnpm typecheck
pnpm test
```

Observed result:

```text
1 passed | 9 skipped
10 passed
typecheck passed
543 passed
```

Evidence boundary:

- This is generated evidence validation support only.
- No real provider CLI was called.
- No real provider resource was created, linked, deployed, smoked, or mutated.
- The real M1 Ledger, Connect, Deploy, Auth, Data, and Evidence checkboxes remain unchecked.

Next smallest step:

Run the real `m1:ledger:record` helper for preview Clerk, Convex, and Vercel resources, then `m1:providers:link`, then `m1:preview:deploy -- --confirm-live-mutation`, then `m1:preview:smoke`, then `m1:evidence:check`.
