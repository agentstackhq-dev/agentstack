# Agentstack Guardrails

## Lean Generated App

Generated apps contain app code and typed config. Do not add generated docs, scripts, or framework internals to satisfy an Agentstack workflow.

Expected root surface:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
pnpm-workspace.yaml
```

Optional installed skills from `agentstack skills install codex` live under `.agents/skills/` because Codex discovers repo skills there.

## Product Boundary

The app depends on `agentstack`. Provider glue, validation, diagnostics, smoke checks, evidence generation, and command help are package-owned.

Use generated package scripts or the public `agentstack` binary. Do not use direct imports such as `generateProject`, `runAgentstack`, provider helpers, or telemetry helpers as the consumer success path.

## Live Provider Safety

Preview provider mutation requires explicit confirmation:

```sh
corepack pnpm run preview:up -- --confirm-live-mutation
```

Do not create, link, mutate, or clean real provider resources through manual dashboard work unless an Agentstack package command prints the exact required handoff.
