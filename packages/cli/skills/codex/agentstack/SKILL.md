---
name: agentstack
description: Use when working in an Agentstack generated app: validate the lean app, run local dev, bootstrap preview providers, smoke auth/data/billing, or inspect package-owned evidence without copying framework internals.
---

# Agentstack App Workflow

This repository is an Agentstack generated app. Keep the app lean and use the installed `agentstack` package for framework workflows.

## First Steps

1. Read `AGENTS.md`.
2. Read `agentstack.config.ts`.
3. Run `corepack pnpm run validate` before changing framework-facing behavior.
4. Use `corepack pnpm run dev:check` for local preflight diagnostics.
5. Use `corepack pnpm run dev` for local web development.

## Package-Owned Commands

Use package scripts that call the installed `agentstack` binary:

- `corepack pnpm run validate`
- `corepack pnpm run dev:check`
- `corepack pnpm run dev`
- `corepack pnpm run preview:sync`
- `corepack pnpm run preview:up -- --confirm-live-mutation`
- `corepack pnpm run preview:smoke`
- `corepack pnpm run evidence:check`
- `corepack pnpm run billing:bootstrap`
- `corepack pnpm run billing:fixture`
- `corepack pnpm run billing:smoke`

## Guardrails

- Do not copy Agentstack framework docs, scripts, runbooks, provider ledgers, or package internals into the generated app.
- Do not use direct imports from framework source packages as the app success path.
- Do not mutate live providers unless the command requires and receives `--confirm-live-mutation`.
- Store mutable runtime state and evidence under `.agentstack/` when package commands create it.
- If this skill is missing in a fresh app, reinstall it with `agentstack skills install codex`.

## References

- `references/workflows.md`
- `references/guardrails.md`
- `references/validation.md`
