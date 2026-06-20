# Validation

Run `pnpm run validate` for local checks before completion.

Run `pnpm run theme:validate` when editing `packages/theme/tokens.json` or `packages/theme/src/index.ts`. The normal local validation gate also includes theme diagnostics and blocks completion when required token paths are missing or invalid.

Required custom env declarations are satisfied from `.agentstack/env-values.json` using the environment -> surface -> variable shape documented in `docs/agentstack/environments.md`.

Local validation also scans source, docs, and `.env` files for raw secret-like values. Use `agentstack env set` for local-cloud preview state. Real provider adapters and provider secret stores are future work.

Run `pnpm run env:inspect` when provider state, environment sync, or deployment readiness matters. Use `pnpm run preview:plan` to plan local-cloud repair, `pnpm run preview:apply` to apply it, `pnpm run preview:validate` to compare expected preview state with configured services, and `pnpm run preview:deploy` to rehearse deploy planning locally.

Generated scripts delegate to an installed `agentstack` CLI. For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` to the framework CLI entrypoint and `AGENTSTACK_TSX_BIN` to the local `tsx` runner before running package scripts.
