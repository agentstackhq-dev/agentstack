# Local Agentstack Quickstart

Last reviewed: 2026-06-29

Use this when Agentstack is being tested from the local source checkout. For the completed M4 clean-machine smoke, use
[M4-clean-machine-smoke.md](../milestones/M4-clean-machine-smoke.md), which validates local `pnpm pack` artifacts from a
clean consumer workspace instead of source `link:` specs.

## 1. Verify PATH Binary

The supported consumer entrypoint is `agentstack`. The local development binary should resolve to this checkout:

```sh
which agentstack
realpath "$(which agentstack)"
```

Expected on this machine:

```text
<node-bin>/agentstack
<agentstack-repo>/packages/agentstack/src/bin.js
```

`agentstack --help` must show `create`. If it does not, the visible binary is stale or points directly at
`@agentstack/cli` instead of the `agentstack` facade package.

If `which agentstack` points at an old symlink, remove that symlink and reinstall from this checkout:

```sh
rm "$(which agentstack)"
cd <agentstack-repo>
corepack pnpm install
```

Do not check for or run a `create-agent-stack` binary. It is not a supported consumer entrypoint.

## 2. Generate From Local Source

Preferred path:

```sh
cd ~/code
agentstack create ags01 --package-spec link:<agentstack-repo>/packages/agentstack
cd ags01
corepack pnpm install
corepack pnpm run validate
corepack pnpm run dev:check
```

The `--package-spec` value is required for local source testing. Without it, the generated app may try to install
`agentstack` from the public npm registry. This source-link path is not the M4 clean-machine proof; M4 uses local packed
tarballs and records evidence separately.

## 3. Repeated Local Runs

For repeated local tests, set the package spec once in the shell:

```sh
export AGENTSTACK_PACKAGE_SPEC=link:<agentstack-repo>/packages/agentstack
cd ~/code
agentstack create ags02
```

`agentstack create` honors `AGENTSTACK_PACKAGE_SPEC`.

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
corepack pnpm run dev:check
```

## 5. Workspace File

Generated apps include `pnpm-workspace.yaml` at the root. Keep it committed. It is required for pnpm installs and
TypeScript language servers to resolve `apps/*` packages consistently.

## 6. Local Rehearsal Vs Live Preview

`pnpm run preview:sync` runs `agentstack sync --env preview --apply`. It is local rehearsal only: it updates ignored
`.agentstack/` state and does not mutate Clerk, Convex, Vercel, EAS, or any other live provider.

Use the explicit confirmation gate for the live provider-backed preview path:

```sh
corepack pnpm run preview:up -- --confirm-live-mutation
corepack pnpm run preview:smoke
corepack pnpm run evidence:check
```

`preview:up` runs provider bootstrap, provider link, auth user setup, and preview deploy in order. It now also:

- pulls Clerk preview env into ignored `.agentstack/clerk-preview.env`
- discovers the Clerk issuer from Clerk domains before falling back to publishable-key decoding
- creates the Convex project context automatically when the preview deployment command reports no configured project
- writes redacted provider-env inventory to `.agentstack/provider-env.json`
- sets Vercel preview env and disables Vercel SSO Deployment Protection when the Vercel CLI reports it is blocking previews

It stops at the first failing step and prints the next action from the package-owned command. `preview:smoke` captures
the signed-in preview DOM with the package-owned Clerk smoke user, writes `.agentstack/m2-preview-dom.html`, and then
runs the same marker validation as `agentstack smoke --env preview`.

## 7. Next Validation Steps

Use `corepack pnpm run dev` when you want to start the local web server. It is long-running, so keep it in its own
terminal while you run other checks.

After local `validate` passes, follow the relevant milestone docs:

- M2 preview path: `docs/milestones/M2-agent-completes-m1.md`
- M3 billing path: `docs/milestones/M3-billing-webhook.md`
- M3 Clerk Billing details: `docs/references/m3-clerk-billing-fixture.md`
- M4 local-pack clean-machine smoke: `docs/milestones/M4-clean-machine-smoke.md`

Do not use source `link:` specs as M4 pass evidence. M4 pass evidence must come from packed artifacts in a clean consumer
workspace and must not include live provider mutation.
