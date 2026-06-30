# M5 Local Preview Release Check - 2026-06-30

Command:

```sh
corepack pnpm run m5:release:check
```

Result: **PASS**

What passed:

- Built all publishable Agentstack packages to `dist`
- Packed `@agentstackhq/core`, `@agentstackhq/adapters`, `@agentstackhq/telemetry`, `@agentstackhq/cli`, and `@agentstackhq/agentstack`
- Inspected packed manifests for scoped names, `0.1.0-beta.3`, allowlisted files, no `workspace:`, no `link:`, and no local
  user-home paths
- Installed the packed `@agentstackhq/agentstack` facade into a clean temp launcher with local tarball overrides for internal
  packages
- Ran `agentstack --help` and `agentstack create` from the packed facade package
- Installed the generated app and ran `typecheck`, `validate`, `dev:check`, and `@app/web` build
- Verified `preview:up` refuses without `--confirm-live-mutation`
- Verified the generated app uses `@agentstackhq/agentstack`, has no legacy unscoped package references, has no copied
  framework docs/scripts/skills/packages, and has no untyped Convex API access in web/mobile surfaces

Redacted output summary:

```text
PASS m5 preview release check
Packed artifacts:
- @agentstackhq/core: .../agentstackhq-core-0.1.0-beta.3.tgz
- @agentstackhq/adapters: .../agentstackhq-adapters-0.1.0-beta.3.tgz
- @agentstackhq/telemetry: .../agentstackhq-telemetry-0.1.0-beta.3.tgz
- @agentstackhq/cli: .../agentstackhq-cli-0.1.0-beta.3.tgz
- @agentstackhq/agentstack: .../agentstackhq-agentstack-0.1.0-beta.3.tgz
Verified commands:
- package build
- packed package manifest inspection
- packed launcher install
- agentstack --help from tarball install
- agentstack create from tarball install
- generated app pnpm install
- generated app pnpm run typecheck
- generated app pnpm run validate
- generated app pnpm run dev:check
- generated web build
- generated app preview:up confirmation gate
- generated app scoped package and no legacy Convex API assertions
```

Follow-up M5 work:

- Publish `@agentstackhq/*@0.1.0-beta.3` packages to npm with the `beta` dist-tag
- Run the post-publish registry smoke without local tarball overrides

Status: completed in
[m5-npm-beta-registry-smoke-2026-06-30.md](./m5-npm-beta-registry-smoke-2026-06-30.md).
