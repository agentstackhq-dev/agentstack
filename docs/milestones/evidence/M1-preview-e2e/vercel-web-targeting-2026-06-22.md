# Vercel Web Targeting - 2026-06-22

Target checkbox: Deploy

Status: support path improved; checkbox remains open until a real Vercel preview deploy produces a preview URL.

## What Changed

- Added generated root `vercel.json` to the B2B SaaS template.
- The config sets `framework` to `vite`.
- The config sets `buildCommand` to `pnpm --filter @app/web build`.
- The config sets `outputDirectory` to `apps/web/dist`.
- The config adds an SPA rewrite to `index.html`.
- Added `vercel.json` to generated required anchors.
- Updated generated preview and environment docs to explain that root `vercel deploy` targets the generated web app through `vercel.json`.

## Verification

Focused command:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"
```

Result: pass.

Assertions covered:

- Generated project contains `vercel.json`.
- Generated config has Vite framework, `@app/web` build command, and `apps/web/dist` output directory.
- Generated required anchors include `vercel.json`.
- Generated preview and environments docs mention the root `vercel.json` targeting behavior.

## Blocker

No real Vercel preview deploy was run in this slice. M1 Deploy still requires ledgered real preview provider resources and `provider:vercel:apply:preview` output with `Deploy URL:`.
