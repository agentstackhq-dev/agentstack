# M4 Local-Pack Clean-Machine Smoke - 2026-06-29

## Result

PASS. The local `pnpm pack` clean-consumer smoke completed through the package-owned public `agentstack` bin and generated
app package scripts.

Command:

```sh
corepack pnpm run m4:pack:smoke
```

Result summary:

```text
PASS m4 local-pack smoke
Verified commands:
- packed launcher install
- agentstack --help from tarball install
- agentstack create from tarball install
- generated app pnpm install
- generated app pnpm run validate
- generated app pnpm run dev:check
- generated app preview:up confirmation gate
```

## Packed Artifacts

Pack directory:

```text
<temp-dir>/agentstack-m4-pack
```

Artifacts:

```text
agentstack-0.0.0.tgz
agentstack-adapters-0.0.0.tgz
agentstack-cli-0.0.0.tgz
agentstack-core-0.0.0.tgz
agentstack-telemetry-0.0.0.tgz
```

The packed public `agentstack` tarball included the pack-safe template fallback:

```text
package/templates/b2b-saas/_gitignore
package/package.json
```

## Clean Consumer Workspace

Consumer workspace:

```text
<temp-dir>/agentstack-m4-consumer
```

Generated app:

```text
<temp-dir>/agentstack-m4-consumer/m4-smoke
```

The generated app direct framework dependency was only `agentstack`:

```json
"dependencies": {
  "agentstack": "file:<temp-dir>/agentstack-m4-pack/agentstack-0.0.0.tgz"
}
```

Internal workspace packages were install plumbing under `pnpm.overrides`, not direct app dependencies:

```json
"pnpm": {
  "overrides": {
    "@agentstack/core": "file:<temp-dir>/agentstack-m4-pack/agentstack-core-0.0.0.tgz",
    "@agentstack/adapters": "file:<temp-dir>/agentstack-m4-pack/agentstack-adapters-0.0.0.tgz",
    "@agentstack/telemetry": "file:<temp-dir>/agentstack-m4-pack/agentstack-telemetry-0.0.0.tgz",
    "@agentstack/cli": "file:<temp-dir>/agentstack-m4-pack/agentstack-cli-0.0.0.tgz"
  }
}
```

No generated app `package.json` source `link:` specs were used.

## Validation Output

`corepack pnpm run validate`:

```text
Evidence: local-structure
Scope: local filesystem structure only; no package commands
PASS validate
```

`corepack pnpm run dev:check`:

```text
PASS dev preflight development web
WARN dev cloud development
FAIL cloud.service.missing
Path: development.clerk
clerk is not linked in development.
Fix: Run agentstack sync --env development --apply.
Blocks: validate --cloud
FAIL cloud.service.missing
Path: development.convex
convex is not linked in development.
Fix: Run agentstack sync --env development --apply.
Blocks: validate --cloud
Next commands:
- pnpm run validate
- pnpm run dev
- pnpm run env:inspect
- agentstack sync --env development --apply
- agentstack validate --cloud --env development
- corepack pnpm --filter @app/web dev
- corepack pnpm --filter @app/mobile dev
```

The cloud-link diagnostics are expected for a clean local app with no provider links. The command exited successfully.

## Live-Mutation Boundary

No live provider bootstrap, link, billing, smoke, or deploy mutation was run.

The smoke verified the live-preview confirmation gate:

```text
EXIT=1
FAIL preview.up.confirmation-required
Fix: Run agentstack preview up --env preview --confirm-live-mutation.
```
