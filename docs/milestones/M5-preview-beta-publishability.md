# M5: Preview Beta Publishability

Status: **passed** (GitHub Actions beta publish and public npm registry smoke passed on 2026-06-30)

## Hypothesis under test

A consumer can install the early preview beta package from npm, run the `agentstack` binary, generate the lean app, and
run local validation without depending on the Agentstack source workspace.

## Done when

- [x] Public package contract is scoped as `@agentstackhq/agentstack` while exposing the `agentstack` CLI binary
- [x] Generated apps depend on `@agentstackhq/agentstack`, import config helpers from `@agentstackhq/agentstack/config`, and
      do not use the legacy unscoped `agentstack` dependency
- [x] Published package manifests build to `dist`, pack only allowlisted files, and use registry-safe exact versions for
      internal package dependencies
- [x] `corepack pnpm run m5:release:check` builds, packs, installs, generates, typechecks, validates, runs `dev:check`,
      builds web, and verifies the preview live-mutation confirmation gate
- [x] The generated app has no copied framework docs/scripts/skills/packages, no legacy unscoped package references, and no
      untyped Convex API usage in web/mobile surfaces
- [x] npm `@agentstackhq/*@0.1.0-beta.6` packages are published with signed provenance and the `beta` dist-tag
- [x] A fresh temp consumer installs `@agentstackhq/agentstack@beta` from the public npm registry with no local tarball
      overrides, runs `agentstack create`, and passes generated app `install`, `typecheck`, `validate`, `dev:check`, and
      web build
- [x] Redacted post-publish registry evidence is recorded in `docs/milestones/evidence/M5-preview-beta-publishability/`

## Command shape to prove

Local pre-publish release check:

```sh
cd <agentstack-repo>
corepack pnpm run m5:release:check
```

Post-publish registry check shape:

```sh
mkdir -p /tmp/agentstack-m5-registry
cd /tmp/agentstack-m5-registry
corepack pnpm dlx @agentstackhq/agentstack@beta create registry-smoke
cd registry-smoke
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run validate
corepack pnpm run dev:check
corepack pnpm --filter @app/web build
```

## Current evidence

- [m5-local-preview-release-check-2026-06-30.md](./evidence/M5-preview-beta-publishability/m5-local-preview-release-check-2026-06-30.md)
- [m5-npm-beta-registry-smoke-2026-06-30.md](./evidence/M5-preview-beta-publishability/m5-npm-beta-registry-smoke-2026-06-30.md)
- [m5-npm-beta6-release-2026-06-30.md](./evidence/M5-preview-beta-publishability/m5-npm-beta6-release-2026-06-30.md)

## Not this milestone

- Hosted control plane
- Production provider gates
- Production billing setup
- EAS/mobile live builds
- Broad provider matrix coverage
- Public GitHub history publication
