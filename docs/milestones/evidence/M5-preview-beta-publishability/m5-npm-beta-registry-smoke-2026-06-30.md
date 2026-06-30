# M5 npm Beta Registry Smoke - 2026-06-30

Command shape:

```sh
npm view @agentstackhq/core version dist-tags --json
npm view @agentstackhq/telemetry version dist-tags --json
npm view @agentstackhq/adapters version dist-tags --json
npm view @agentstackhq/cli version dist-tags --json
npm view @agentstackhq/agentstack version dist-tags --json

mkdir -p /tmp/agentstack-m5-registry
cd /tmp/agentstack-m5-registry
corepack pnpm --package=@agentstackhq/agentstack@0.1.0-beta.3 dlx agentstack create registry-smoke
cd registry-smoke
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run validate
corepack pnpm run dev:check
corepack pnpm --filter @app/web build
corepack pnpm run preview:up
```

Result: **PASS**

Published package state:

```text
@agentstackhq/core       latest: 0.1.0-beta.3, beta: 0.1.0-beta.3
@agentstackhq/telemetry  latest: 0.1.0-beta.3, beta: 0.1.0-beta.3
@agentstackhq/adapters   latest: 0.1.0-beta.3, beta: 0.1.0-beta.3
@agentstackhq/cli        latest: 0.1.0-beta.3, beta: 0.1.0-beta.3
@agentstackhq/agentstack latest: 0.1.0-beta.3, beta: 0.1.0-beta.3
```

What passed:

- Installed and ran the public `agentstack` binary from `@agentstackhq/agentstack@0.1.0-beta.3`
- Generated a fresh lean app at `/tmp/agentstack-m5-registry/registry-smoke`
- Installed the generated app from the public npm registry, with no local tarball overrides
- Ran generated app `typecheck`, `validate`, `dev:check`, and `@app/web` build
- Verified Convex API codegen/typecheck assistance runs during `validate` and `dev:check`
- Verified `preview:up` refuses live mutation without `--confirm-live-mutation`

Redacted output summary:

```text
Created registry-smoke
dependencies:
+ @agentstackhq/agentstack 0.1.0-beta.3

> registry-smoke@ typecheck
> tsc -p apps/convex/tsconfig.json && tsc -p apps/web/tsconfig.json && tsc -p apps/mobile/tsconfig.json

> registry-smoke@ validate
Convex API types: already current
Command: corepack pnpm --filter @app/convex exec convex codegen --typecheck try
PASS validate

> registry-smoke@ dev:check
Convex API types: already current
Command: corepack pnpm --filter @app/convex exec convex codegen --typecheck try
PASS dev preflight development web

> @app/web@ build
vite v6.4.3 building for production...
✓ built

> registry-smoke@ preview:up
FAIL preview.up.confirmation-required
Fix: Run agentstack preview up --env preview --confirm-live-mutation.
```

Publish-path issues fixed before the passing beta:

- `0.1.0-beta.1` exposed npm metadata consistency problems after a partial publish attempt.
- `0.1.0-beta.2` exposed that npm publish preserves raw `workspace:` dependencies and that the published bin must not
  depend on `tsx`.
- `0.1.0-beta.3` is the first registry-smoked beta line and both `latest` and `beta` dist-tags point to it.
