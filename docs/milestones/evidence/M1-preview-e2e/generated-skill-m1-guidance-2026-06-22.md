# Generated Skill M1 Guidance Evidence

Date: 2026-06-22

Milestone checkbox targeted: Evidence and generated guidance for the M1 real-provider path.

Result: generated skill guidance alignment PASS; M1 real acceptance unchanged because no real provider resources were ledgered, linked, deployed, or smoked.

Change:

- Updated `skills/agentstack/references/workflows.md` in both template mirrors to include the M1 web-only preview sequence: provider plans, `m1:ledger:record`, `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, and `m1:preview:smoke`.
- Updated `skills/agentstack/references/guardrails.md` in both template mirrors so local rehearsal wording excludes the explicit live-mutation `m1:preview:deploy` helper.
- Updated generated `AGENTS.md` in both template mirrors so agent instructions also exclude the explicit live-mutation `m1:preview:deploy` helper from rehearsal-only wording.
- Added generated-project tests that assert the generated skill workflow, guardrail references, and `AGENTS.md` include the M1 helper sequence and mutation boundary.

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

- This is generated guidance and test coverage only.
- No real provider CLI was called.
- No real provider resource was created, linked, or mutated.
- The real M1 Ledger, Connect, Deploy, Auth, Data, and Evidence checkboxes remain unchecked.

Next smallest step:

Run the real `m1:ledger:record` helper for preview Clerk, Convex, and Vercel resources, then `m1:providers:link`, then `m1:preview:deploy -- --confirm-live-mutation`.
