# Environments

This template defines `development`, `preview`, and `production`.

Declare required custom environment values in `agentstack.config.json` under `env.custom`.
For this prototype, local validation reads actual values from `.agentstack/env-values.json` when the file exists. Treat that file as CLI-managed local state instead of editing it by hand.

Use `agentstack env set` to write values. The CLI validates the environment, surface, declared variable name, declaration scope, and enum values before updating local state:

```bash
agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox
```

Use `agentstack env inspect --env preview` or `pnpm run env:inspect` to confirm whether declared bindings are present without exposing secret values.

Missing `.agentstack/env-values.json` is treated as an empty value set. Invalid JSON or non-string values fail `validate` and `validate:cloud`.
