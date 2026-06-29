# M4: Clean-Machine Generate + Smoke

Status: **complete** (local `pnpm pack` clean-consumer smoke passed on 2026-06-29)

## Hypothesis under test

A consumer can install Agentstack packages, generate an app, and run documented validation on a clean machine without monorepo source paths.

## Done when

- [x] Local `pnpm pack` artifacts produced for every Agentstack workspace package needed by a consumer install
- [x] Clean temp consumer workspace installs Agentstack from packed tarballs, not `link:` dependencies or monorepo source paths
- [x] Consumer app generated through the public `agentstack` bin
- [x] Generated app install, `validate`, and `dev:check` pass using only generated app package scripts
- [x] No live provider mutation is required or executed
- [x] Evidence in `docs/milestones/evidence/M4-clean-machine-smoke/`

## Approved approach

Use local `pnpm pack` artifacts for the first M4 smoke. Public npm publish, private registries, and hosted control-plane
packaging are out of scope for M4.

The smoke should run from a fresh temp directory outside `<agentstack-repo>`. It may build and pack from
the framework checkout, but the generated consumer app must install tarball package specs and must not depend on
`link:<agentstack-repo>/...`, direct `tsx` execution from package sources, or copied framework internals.

The clean smoke packs `agentstack` plus its internal workspace dependencies, then installs the public `agentstack`
tarball with `pnpm.overrides` for the internal tarballs. Generated apps still expose only `agentstack` as a direct
framework dependency.

## Command shape to prove

Run the repeatable local-pack smoke from the framework repo:

```sh
cd <agentstack-repo>
corepack pnpm run m4:pack:smoke
```

The script:

- packs `@agentstack/core`, `@agentstack/adapters`, `@agentstack/telemetry`, `@agentstack/cli`, and `agentstack`
- installs the packed public `agentstack` tarball into a clean temp launcher workspace
- runs the tarball-provided `agentstack --help`
- runs the tarball-provided `agentstack create`
- installs the generated app from tarball specs and internal `pnpm.overrides`
- runs generated app `pnpm run validate`
- runs generated app `pnpm run dev:check`
- verifies `pnpm run preview:up` refuses without `--confirm-live-mutation`

## Evidence expectations

Evidence:

- [m4-local-pack-smoke-2026-06-29.md](./evidence/M4-clean-machine-smoke/m4-local-pack-smoke-2026-06-29.md)

## Not this milestone

- Hosted control plane
- Full production gates
- Public npm publish
- Live provider mutation
- M5 packaging/release automation

## Current next step

Stop before M5/public release automation. Discuss whether the next packaging move should be public npm publishing,
release provenance, package build outputs, or broader clean-host/container coverage.
