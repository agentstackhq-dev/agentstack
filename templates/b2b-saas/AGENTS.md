# Agent Rules

This is an Agentstack app. Keep the generated project lean and let the installed
`agentstack` package own framework workflows, provider glue, diagnostics, and
runbooks.

## Working Contract

- Use `agentstack.config.ts` as the typed source of truth for app, surface,
  provider, environment, and telemetry settings.
- Use package-owned Agentstack CLI help instead of generated runbooks.
- Store mutable provider state, auth fixtures, smoke artifacts, ledgers, and
  evidence under ignored `.agentstack/` files.
- Do not add generated `docs/`, `scripts/`, `skills/`, root `convex/`, root
  `vercel.json`, or root `packages/` framework internals to this app.

## Happy Path

- `pnpm run validate`
- `pnpm run dev`
- `pnpm run preview:up -- --confirm-live-mutation`

`pnpm run dev:check` is diagnostics-only. `pnpm run dev` starts the local web
surface.

## Commands

- `pnpm run validate`
- `pnpm run dev`
- `pnpm run dev:check`
- `pnpm run doctor`
- `pnpm run env:inspect`
- `pnpm run preview:sync`
- `pnpm run preview:up`
- `pnpm run provider:bootstrap`
- `pnpm run provider:link`
- `pnpm run auth:user`
- `pnpm run billing:bootstrap`
- `pnpm run billing:fixture`
- `pnpm run billing:smoke`
- `pnpm run preview:deploy`
- `pnpm run preview:smoke`
- `pnpm run evidence:check`

When a command fails, fix the first failing Agentstack diagnostic before
broadening the investigation.
