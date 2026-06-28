# M1 Preview Deploy Helper Evidence

Date: 2026-06-22

Milestone checkbox targeted: Deploy support.

Result: generated helper support PASS; M1 Deploy acceptance unchanged because no real Vercel preview deploy was run.

Implemented generated surface:

- `pnpm run m1:preview:deploy -- --confirm-live-mutation`
- Requires explicit `--confirm-live-mutation`.
- Runs ledger-gated Convex preview apply, then ledger-gated Vercel preview deploy apply.
- Captures the emitted `Deploy URL: ...` line.
- Writes redacted local evidence to `docs/milestones/evidence/M1-preview-e2e/deploy-url.txt` and `docs/milestones/evidence/M1-preview-e2e/deploy-output.txt`.

Verification:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts"
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
pnpm vitest run packages/adapters/src/vercel.test.ts packages/adapters/src/provider-ledger.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts
pnpm typecheck
pnpm test
```

Observed result:

```text
1 passed | 9 skipped
10 passed
280 passed
typecheck passed
543 passed
```

Evidence boundary:

- The test uses a generated-project fake Agentstack CLI entrypoint.
- No real provider CLI was called.
- No real provider resource was created, linked, or mutated.
- The real M1 Ledger, Connect, Deploy, Auth, Data, and Evidence checkboxes remain unchecked.

Next smallest step:

Run the real `m1:ledger:record` helper for preview Clerk, Convex, and Vercel resources, then `m1:providers:link`, then `m1:preview:deploy -- --confirm-live-mutation`.
