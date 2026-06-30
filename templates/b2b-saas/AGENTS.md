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

- `corepack pnpm run validate`
- `corepack pnpm run dev`
- `corepack pnpm run preview:sync`
- `corepack pnpm run preview:up -- --confirm-live-mutation`

`corepack pnpm run dev:check` is diagnostics-only. `corepack pnpm run dev`
starts the local web surface. `corepack pnpm run preview:sync` is local
rehearsal only: it updates ignored `.agentstack/` state and does not mutate
live providers. Use `corepack pnpm run preview:up -- --confirm-live-mutation`
for the live provider-backed preview path.

## Commands

Optional repo-local Codex skills can be installed after creation with
`agentstack skills install codex`. The command writes normal scaffold files
under `.agents/skills/`; decide in your repo whether to track or ignore them.

- `corepack pnpm run validate`
- `corepack pnpm run dev`
- `corepack pnpm run dev:check`
- `corepack pnpm run doctor`
- `corepack pnpm run env:inspect`
- `agentstack skills install codex` (optional Codex repo-skill scaffold)
- `corepack pnpm run preview:sync` (local rehearsal only)
- `corepack pnpm run preview:up -- --confirm-live-mutation` (live provider-backed)
- `corepack pnpm run provider:bootstrap`
- `corepack pnpm run provider:link`
- `corepack pnpm run auth:user`
- `corepack pnpm run billing:bootstrap`
- `corepack pnpm run billing:fixture`
- `corepack pnpm run billing:smoke`
- `corepack pnpm run preview:deploy`
- `corepack pnpm run preview:smoke`
- `corepack pnpm run evidence:check`

When a command fails, fix the first failing Agentstack diagnostic before
broadening the investigation.
