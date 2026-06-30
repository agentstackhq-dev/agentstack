# M5 npm Beta 6 Release - 2026-06-30

Command shape:

```sh
corepack pnpm run release:check
gh workflow run release.yml --repo agentstackhq-dev/agentstack --ref main \
  -f version=0.1.0-beta.6 -f dist_tag=beta -f dry_run=false
gh run watch --repo agentstackhq-dev/agentstack 28442287470 --exit-status

npm view @agentstackhq/core@0.1.0-beta.6 version dist-tags repository --json
npm view @agentstackhq/telemetry@0.1.0-beta.6 version dist-tags repository --json
npm view @agentstackhq/adapters@0.1.0-beta.6 version dist-tags repository --json
npm view @agentstackhq/cli@0.1.0-beta.6 version dist-tags repository --json
npm view @agentstackhq/agentstack@0.1.0-beta.6 version dist-tags repository --json
```

Result: **PASS**

GitHub evidence:

- CI run: `https://github.com/agentstackhq-dev/agentstack/actions/runs/28442181006`
- Release run: `https://github.com/agentstackhq-dev/agentstack/actions/runs/28442287470`
- Release commit: `77a3d80ab55ef7aca7aa97067e836b7eeeee91f2`
- Release workflow result: `success`

Release workflow checks:

- Release gate passed in GitHub Actions before publish.
- `Publish to npm` passed for all five public packages.
- npm logged `Signed provenance statement with source and build information from GitHub Actions` for each package.
- `Registry smoke` passed against `@agentstackhq/agentstack@0.1.0-beta.6`.

Published package state:

```text
@agentstackhq/core       beta: 0.1.0-beta.6, repository: git+https://github.com/agentstackhq-dev/agentstack.git, directory: packages/core
@agentstackhq/telemetry  beta: 0.1.0-beta.6, repository: git+https://github.com/agentstackhq-dev/agentstack.git, directory: packages/telemetry
@agentstackhq/adapters   beta: 0.1.0-beta.6, repository: git+https://github.com/agentstackhq-dev/agentstack.git, directory: packages/adapters
@agentstackhq/cli        beta: 0.1.0-beta.6, repository: git+https://github.com/agentstackhq-dev/agentstack.git, directory: packages/cli
@agentstackhq/agentstack beta: 0.1.0-beta.6, repository: git+https://github.com/agentstackhq-dev/agentstack.git, directory: packages/agentstack
```

Redacted release-log summary:

```text
+ @agentstackhq/core@0.1.0-beta.6
+ @agentstackhq/telemetry@0.1.0-beta.6
+ @agentstackhq/adapters@0.1.0-beta.6
+ @agentstackhq/cli@0.1.0-beta.6
+ @agentstackhq/agentstack@0.1.0-beta.6
PASS release publish 0.1.0-beta.6 beta
PASS registry smoke @agentstackhq/agentstack@0.1.0-beta.6
```

Notes:

- `0.1.0-beta.5` published successfully but its release workflow failed after publish because immediate npm dist-tag
  verification observed stale registry data. `scripts/release/publish.mjs` now retries post-publish dist-tag reads before
  failing.
- Package manifests now use npm's canonical `git+https://github.com/agentstackhq-dev/agentstack.git` repository URL form,
  and the release contract enforces it.
