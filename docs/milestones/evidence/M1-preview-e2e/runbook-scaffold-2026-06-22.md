# M1 Runbook Scaffold Evidence

Date: 2026-06-22

Milestone checkbox targeted: Evidence support for the real M1 provider run.

Result: generated runbook scaffold PASS; M1 real acceptance unchanged because no real provider resources were ledgered, linked, deployed, or smoked.

Change:

- Added `docs/milestones/evidence/M1-preview-e2e/runbook.md` to both generated template mirrors.
- Made the runbook a generated required anchor.
- The scaffold records M1 provider plans, ledger, link, deploy, smoke, checkbox review, blockers, and smallest next step.
- Updated generated preview docs and evidence README to point operators at the runbook during the real M1 run.

Verification:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project"
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

- This is generated evidence scaffolding only.
- No real provider CLI was called.
- No real provider resource was created, linked, deployed, smoked, or mutated.
- The real M1 Ledger, Connect, Deploy, Auth, Data, and Evidence checkboxes remain unchecked.

Next smallest step:

Run the real `m1:ledger:record` helper for preview Clerk, Convex, and Vercel resources, then `m1:providers:link`, then `m1:preview:deploy -- --confirm-live-mutation`, updating the generated `runbook.md` as each step runs.
