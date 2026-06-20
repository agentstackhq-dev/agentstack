# Validation

Run `pnpm run validate` for local checks before completion.

Run `pnpm run validate:cloud` when provider state, environment sync, or deployment readiness matters. Cloud validation compares expected framework state with configured services. Use `pnpm run init:cloud` to initialize the local prototype cloud state first.

Generated scripts delegate to an installed `agentstack` CLI. For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` to the framework CLI entrypoint and `AGENTSTACK_TSX_BIN` to the local `tsx` runner before running package scripts.
