# M1 Vercel Deploy URL Evidence Support — 2026-06-22

## Scope

Local unit coverage only. No real Vercel deployment was executed in this evidence item.

## Behavior Added

`agentstack provider apply --service vercel --env preview` now extracts the first `https://*.vercel.app` URL from successful Vercel deploy stdout and prints:

```text
Deploy URL: https://<preview-deployment>.vercel.app
```

The deploy command output remains redacted in diagnostics, and the URL is surfaced separately for the M1 evidence bundle.

## Verification

Focused tests:

```bash
pnpm vitest run packages/adapters/src/vercel.test.ts -t "executes only preview deploy for Vercel apply"
pnpm vitest run packages/cli/src/run.test.ts -t "allows Vercel preview deploy when the provider ledger has a planned project row"
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"
```

Repo gates were also run after this change:

```bash
pnpm vitest run packages/adapters/src/provider-ledger.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts
pnpm typecheck
pnpm test
```

## Result

PASS for deploy URL evidence support. The M1 Deploy checkbox remains unchecked until a real Vercel preview deploy is executed and the resulting URL is recorded.
