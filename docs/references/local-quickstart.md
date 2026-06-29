# Local Agentstack Quickstart

Last reviewed: 2026-06-29

Use this while Agentstack is being tested from the local source checkout, before M4 public packaging or clean-machine
installability is validated.

## 1. Verify PATH Binaries

The local development binaries should resolve to this checkout:

```sh
which agentstack
which create-agent-stack
realpath "$(which agentstack)"
realpath "$(which create-agent-stack)"
```

Expected on this machine:

```text
<node-bin>/agentstack
<node-bin>/create-agent-stack
<agentstack-repo>/packages/agentstack/src/bin.js
<agentstack-repo>/packages/create-agent-stack/src/bin.js
```

`agentstack --help` must show `create`. If it does not, the visible binary is stale or points directly at
`@agentstack/cli` instead of the `agentstack` facade package.

## 2. Generate From Local Source

Preferred path:

```sh
cd ~/code
agentstack create ags01 --package-spec link:<agentstack-repo>/packages/agentstack
cd ags01
corepack pnpm install
corepack pnpm run validate
```

The lower-level generator also works:

```sh
cd ~/code
create-agent-stack ags01 --package-spec link:<agentstack-repo>/packages/agentstack
cd ags01
corepack pnpm install
corepack pnpm run validate
```

The `--package-spec` value is required for local source testing. Without it, the generated app may try to install
`agentstack` from the public npm registry. M4 has not validated the public/clean-machine package path yet.

## 3. Repeated Local Runs

For repeated local tests, set the package spec once in the shell:

```sh
export AGENTSTACK_PACKAGE_SPEC=link:<agentstack-repo>/packages/agentstack
cd ~/code
create-agent-stack ags02
```

`agentstack create` and `create-agent-stack` both honor `AGENTSTACK_PACKAGE_SPEC`.

## 4. Repair An Existing Generated App

If `pnpm install` fails with:

```text
ERR_PNPM_NO_MATCHING_VERSION No matching version found for agentstack@0.0.0
```

change the generated app dependency:

```json
"dependencies": {
  "agentstack": "link:<agentstack-repo>/packages/agentstack"
}
```

Then rerun:

```sh
corepack pnpm install
corepack pnpm run validate
```

## 5. Workspace File

Generated apps include `pnpm-workspace.yaml` at the root. Keep it committed. It is required for pnpm installs and
TypeScript language servers to resolve `apps/*` packages consistently.

## 6. Next Validation Steps

After local `validate` passes, follow the active milestone docs:

- M2 preview path: `docs/milestones/M2-agent-completes-m1.md`
- M3 billing path: `docs/milestones/M3-billing-webhook.md`
- M3 Clerk Billing details: `docs/references/m3-clerk-billing-fixture.md`

Do not start M4 clean-machine packaging from this guide. M4 requires an explicit packaging approach discussion first.
