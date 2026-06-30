# Agentstack Workflows

## Local App Loop

Use this path after `agentstack create`:

```sh
corepack pnpm install
corepack pnpm run validate
corepack pnpm run dev:check
corepack pnpm run dev
```

`dev:check` is diagnostics-only. `dev` starts the local web surface after preflight.

## Preview Provider Loop

Preview provider work is explicit:

```sh
corepack pnpm run preview:sync
corepack pnpm run preview:up -- --confirm-live-mutation
corepack pnpm run preview:smoke
corepack pnpm run evidence:check
```

`preview:sync` is local rehearsal. `preview:up -- --confirm-live-mutation` is the live preview bootstrap/link/deploy path.

## Billing Loop

Use the package-owned billing commands:

```sh
corepack pnpm run billing:bootstrap
corepack pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run billing:smoke
```

If a provider CLI prints an auth or browser handoff, follow the exact handoff and then rerun the same package command.
