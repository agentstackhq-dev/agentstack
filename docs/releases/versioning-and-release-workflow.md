# Versioning and Release Workflow

This document is the release contract for Agentstack. The scripts enforce the rules; this document explains how to run
them and how to configure npm/GitHub.

## Lockstep versioning

All public Agentstack packages ship as one lockstep version:

- `@agentstackhq/core`
- `@agentstackhq/telemetry`
- `@agentstackhq/adapters`
- `@agentstackhq/cli`
- `@agentstackhq/agentstack`

Internal dependencies between these packages must be exact versions, not `workspace:`, `link:`, ranges, or local paths.
The generated app template must depend on the same exact `@agentstackhq/agentstack` version and its
`frameworkVersion` must match.

Supported release tags:

- Beta: `vX.Y.Z-beta.N`, package version `X.Y.Z-beta.N`, npm dist-tag `beta`
- Stable: `vX.Y.Z`, package version `X.Y.Z`, npm dist-tag `latest`

During the pre-stable preview line, `latest` must also point at the same version as `beta` so unqualified npm installs
do not resolve to an older preview. The current registry-smoked beta target is `0.1.0-beta.6`.

## Local Release Commands

Prepare a new version:

```sh
corepack pnpm run release:bump -- --version 0.1.0-beta.6
corepack pnpm install --lockfile-only
corepack pnpm run release:check
```

Run an npm publish dry-run from the package manifests that will be published:

```sh
corepack pnpm run release:publish -- --tag beta --dry-run
```

Smoke a published version from the public registry:

```sh
corepack pnpm run release:registry:smoke -- --version 0.1.0-beta.6
```

Promote and verify the preview `latest` dist-tag after a successful beta publish:

```sh
read -s NPM_CONFIG_OTP
export NPM_CONFIG_OTP
corepack pnpm run release:dist-tags -- --version 0.1.0-beta.6 --tag latest --apply
unset NPM_CONFIG_OTP
corepack pnpm run release:dist-tags -- --version 0.1.0-beta.6 --tag latest --check
```

`release:check` runs the local gate:

- package build
- release contract check
- TypeScript typecheck
- full Vitest suite
- M5 tarball release smoke
- template mirror diff
- whitespace diff check
- npm publish dry-runs for all public packages

## GitHub Actions

`.github/workflows/ci.yml` runs `corepack pnpm run release:check -- --skip-npm-dry-run` on pull requests and pushes.
That keeps CI fully unauthenticated while still enforcing the build, type, test, smoke, mirror, and release-contract
checks. The npm publish dry-run remains part of the local release gate and the manual release workflow.
Both workflows install pnpm `9.15.4` before `actions/setup-node` restores the pnpm cache, so cache restore does not
depend on Corepack side effects.

`.github/workflows/release.yml` is manual-only through `workflow_dispatch`. It requires:

- `version`: the version already committed in all package manifests
- `dist_tag`: `beta` for `X.Y.Z-beta.N`, `latest` for `X.Y.Z`
- `dry_run`: `true` to rehearse publish; `false` to publish and run the public registry smoke

The release job uses the `npm-production` GitHub environment. Configure required reviewers on that environment before
allowing non-dry-run publishes.

## Trusted Publishing

Use npm Trusted publishing for every package. Do not add a long-lived npm token to GitHub secrets.

For each package in npm, configure a trusted publisher with:

- Repository owner: the GitHub owner for this repo
- Repository name: this repo
- Workflow filename: `release.yml`
- Environment name: `npm-production`
- Package name: the exact `@agentstackhq/*` package

The release workflow grants `id-token: write`, runs on a GitHub-hosted runner, uses Node 24, and installs npm `^11.5.1`
before publishing. That satisfies the npm Trusted publishing requirements and lets npm issue short-lived credentials
through GitHub OIDC. Trusted publishing automatically generates npm provenance, so the package-owned publish script does
not pass `--provenance`; every package manifest must keep `repository.url` exactly aligned with the GitHub repository
reported by OIDC, using npm's canonical `git+https://github.com/agentstackhq-dev/agentstack.git` form.
After a real publish, the publish script verifies that each configured npm dist-tag resolves to the released version and
retries briefly to tolerate npm registry propagation lag before failing the workflow.
`npm dist-tag add` is a separate npm mutation and may require OTP or a suitably scoped npm token even when package
publication itself uses Trusted Publishing. Use `release:dist-tags` for this post-publish tag promotion instead of raw
one-off commands.

## Failure Policy

- If `release:check` fails, fix the package/template/script contract before publishing.
- If a publish partially succeeds, do not republish the same version. Bump to the next beta and publish the full lockstep
  set again.
- If `release:registry:smoke` fails, leave the failed version in npm history, fix forward, and publish the next beta.
- Do not hand-edit dist-tags. Use `corepack pnpm run release:dist-tags -- --version <version> --tag <tag> --apply` and
  verify with `--check`.
