# Validation

Start with `pnpm run inspect` when you enter the generated repo. It prints the app slug, framework and guidance versions, generated anchor counts, enabled services, and preview local-cloud state without mutating anything.

Run `pnpm run validate` for local checks before completion.

Run `pnpm run doctor` before provider, environment, build, sync, or deploy work. It runs local validation plus preview local-cloud checks and prints repair commands before you open a provider workflow.

Run `pnpm run dev` as a local preflight when you need the next commands for product work. In this prototype it does not start real web, mobile, Convex, Expo, or provider servers; it prints validation, env, sync, web, and mobile commands to run next.

Run `pnpm run theme:validate` when editing `packages/theme/tokens.json` or `packages/theme/src/index.ts`. The normal local validation gate also includes theme diagnostics and blocks completion when required token paths are missing or invalid.

Required custom env declarations are satisfied from `.agentstack/env-values.json` using the environment -> surface -> variable shape documented in `docs/agentstack/environments.md`.

Local validation also scans source, docs, and `.env` files for raw secret-like values. Use `agentstack env set` for local-cloud preview state. Real provider adapters and provider secret stores are future work.

Run `pnpm run env:inspect` when provider state, environment sync, or deployment readiness needs deeper detail after `pnpm run doctor`. Use `pnpm run preview:plan` to plan local-cloud repair, `pnpm run preview:apply` to apply it, `pnpm run preview:validate` to compare expected preview state with configured services, and `pnpm run preview:deploy` to rehearse deploy planning locally.

Use `pnpm run mobile:build:development`, `pnpm run mobile:build:preview`, and `pnpm run mobile:build:production` to validate generated mobile build profiles. The preview apply step writes `.agentstack/builds/mobile-preview.json` only; it does not call Expo or EAS.

Generated scripts delegate to an installed `agentstack` CLI. For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` to the framework CLI entrypoint and `AGENTSTACK_TSX_BIN` to the local `tsx` runner before running package scripts.
