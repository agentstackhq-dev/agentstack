# Workspace Status

`workspace status` is the generated app's first runnable local vertical. It exists to show agents how a small product path should cross shared domain, Convex, web, mobile, docs, telemetry, theme, and unstyled UI primitives without pretending provider deploys are live.

Expected shape:

- Shared domain owns the status type, fixture/default state, and small helpers.
- Convex exposes the local status boundary for generated app code.
- Web renders the status path from the shared contract.
- Mobile renders the same status path from the shared contract.
- `@app/ui` contributes unstyled primitive metadata for status presentation states.
- Docs explain the path as the current generated app pattern for additional workspace-status-adjacent surfaces.

This vertical is local generated app behavior. Generated preview/prod deploy rehearsals, EAS builds, provider command plans, and hosted telemetry export remain rehearsals in this slice. Provider execution is explicit only through `agentstack provider inspect/apply`: Vercel preview inspect runs only `pnpm exec vercel env ls preview`, Vercel preview apply runs only `pnpm exec vercel deploy --target=preview`, and EAS preview inspect runs only `pnpm exec eas env:list --environment preview`.
