# Validation

Run `pnpm run validate` for local checks before completion.

Required custom env declarations are satisfied from `.agentstack/env-values.json` using the environment -> surface -> variable shape documented in `docs/agentstack/environments.md`.

Run `pnpm run env:inspect` when provider state, environment sync, or deployment readiness matters. Use `pnpm run sync:preview` to plan local-cloud repair, `pnpm run sync:preview:apply` to apply it, and `pnpm run validate:cloud` to compare expected preview state with configured services.

Generated scripts delegate to an installed `agentstack` CLI. For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` to the framework CLI entrypoint and `AGENTSTACK_TSX_BIN` to the local `tsx` runner before running package scripts.
