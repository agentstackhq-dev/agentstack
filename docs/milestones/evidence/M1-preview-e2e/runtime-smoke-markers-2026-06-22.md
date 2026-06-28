# M1 Runtime Smoke Marker Evidence Support - 2026-06-22

## Scope

Local generated app build and file inspection only. No provider resources were created, linked, adopted, inspected, mutated, or claimed as M1 Auth/Data evidence.

## App

- Path: `tmp/m1-smoke-marker`
- Template: local `create-agent-stack` B2B SaaS template
- CLI: source checkout under `<agentstack-repo>`

## Commands

```bash
cd <agentstack-repo>/tmp
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/create-agent-stack/src/bin.ts \
  m1-smoke-marker
```

Output:

```text
Created m1-smoke-marker
```

```bash
pnpm install --ignore-scripts
```

Output included package-manager warnings for existing template dependencies, then completed:

```text
Done in 13.7s
```

```bash
pnpm --filter @app/web build
```

Output:

```text
@app/web@ build
vite build
✓ 177 modules transformed.
✓ built in 812ms
```

## Marker Contract

The generated web app exposes stable smoke markers for the later deployed preview check:

- `data-agentstack-auth-state="runtime-not-configured"` when Clerk/Convex env is missing
- `data-agentstack-auth-state="loading"` while Clerk loads
- `data-agentstack-auth-state="signed-out"` before sign-in
- `data-agentstack-auth-state="signed-in"` after Clerk sign-in
- `data-agentstack-protected-data-state="loading"` while the protected Convex query is pending
- `data-agentstack-protected-data-state="protected-data-loaded"` when `workspaceStatus.protectedStatus` returns
- `data-agentstack-protected-workspace-id` when protected Convex data is loaded

Generated file inspection confirmed the markers in:

```text
tmp/m1-smoke-marker/apps/web/src/App.tsx
tmp/m1-smoke-marker/docs/agentstack/auth.md
tmp/m1-smoke-marker/docs/agentstack/preview.md
```

## Result

PASS for local runtime smoke marker support. The generated app and generated auth docs now include deterministic DOM markers that can be captured from the deployed preview URL during the M1 Auth/Data smoke.

This does not satisfy the M1 Auth or Data checkboxes. Those remain unchecked until a deployed Vercel preview URL is exercised with real Clerk sign-in and a successful protected Convex query.

## Next Smallest Step

Record real preview Clerk, Convex, and Vercel rows with `provider:ledger:record`, then use the generated provider commands to connect and deploy before capturing the live marker states.
