# Validation

Start with `pnpm run inspect` when you enter the generated repo. It prints the app slug, framework and guidance versions, generated anchor counts, enabled services, preview local-cloud state, provider adapter contract status, and pending provider operation IDs without mutating anything.

Provider adapters marked `contract-only` have a normalized provider boundary. Pending provider operation IDs are stable and redacted. Environment operations expose variable names only, never values or hashes. An `env.set` operation can appear before a local value is available; sync remains the actionability gate. Provider execution happens only through explicit `agentstack provider inspect/apply`; plan, sync, deploy, build, doctor, and dev commands do not execute provider CLIs.

Run `pnpm run validate` for local checks before completion.

Run `pnpm run doctor` before provider, environment, build, sync, or deploy work. It runs local validation plus preview local-cloud checks and prints repair commands before you open a provider workflow.

Run `pnpm run dev` as a local preflight when you need the next commands for product work. It should point you toward the generated workspace-status web, mobile, and Convex surfaces plus validation, env, and sync commands. It must not mutate provider state.

Run `pnpm run theme:validate` when editing `packages/theme/tokens.json` or `packages/theme/src/index.ts`. The normal local validation gate also includes theme diagnostics and blocks completion when required token paths are missing or invalid.

Required custom env declarations are satisfied from `.agentstack/env-values.json` using the environment -> surface -> variable shape documented in `docs/agentstack/environments.md`. `agentstack env set` writes that local validation state only; it does not create or update provider resources.

Local validation also scans source, docs, and `.env` files for raw secret-like values. Use `agentstack sync --env <env>` for local provider env resource rehearsal after values exist. Sync refuses missing or invalid declared values before planning or applying provider env resources. Applied sync records provider env resources in `.agentstack/local-cloud.json` with redacted/hash-only metadata such as `valueHash`, never raw env values. Clerk, Convex, Vercel, and EAS command-plan adapters print bounded provider CLI command shapes. Clerk/Convex inspect and EAS preview inspect are explicit provider diagnostics. Convex apply is explicit provider execution, and Vercel preview apply executes only the preview deploy command.

Run `pnpm run env:inspect` when provider state, environment sync, or deployment readiness needs deeper detail after `pnpm run doctor`. Use `pnpm run preview:plan` to plan local-cloud repair, `pnpm run preview:apply` to apply it, `pnpm run preview:validate` to compare expected preview state with configured services and provider env resources, and `pnpm run preview:deploy` to rehearse deploy planning locally. `validate --cloud` reports missing, stale, or drifted provider env resources through the same local-cloud contract that command-plan adapters read.

Use `pnpm run mobile:build:development`, `pnpm run mobile:build:preview`, and `pnpm run mobile:build:production` to validate generated mobile build profiles. The preview apply step writes `.agentstack/builds/mobile-preview.json` only; it does not call Expo or EAS. EAS runtime execution is limited to explicit preview `env:list` inspection; project initialization, builds, env mutation execution, production inspect, and apply are unavailable.

Generated scripts delegate to an installed `agentstack` CLI. For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` to the framework CLI entrypoint and `AGENTSTACK_TSX_BIN` to the local `tsx` runner before running package scripts.
