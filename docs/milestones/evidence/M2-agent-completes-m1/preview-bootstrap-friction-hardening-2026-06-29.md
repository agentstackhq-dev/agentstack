# M2 Preview Bootstrap Friction Hardening

Date: 2026-06-29

Result: package-owned hardening implemented; live re-run still uses the normal M2 preview evidence path.

## Remarks addressed

- Clerk issuer discovery moved into provider bootstrap through Clerk domains API, with publishable-key decoding only as a fallback.
- Clerk preview env is pulled into ignored `.agentstack/clerk-preview.env`; a redacted env inventory is written to `.agentstack/provider-env.json`.
- Convex project context is created automatically when preview deployment creation reports no configured project.
- Convex preview deployment creation retries with the full `team:project:preview/<name>` deployment reference.
- Vercel preview env is hydrated during bootstrap and Vercel SSO Deployment Protection is disabled when the Vercel CLI reports it is blocking previews.
- Generated `AGENTS.md` uses `corepack pnpm run ...` for repeatable script execution.
- `agentstack preview smoke --capture` owns signed-in DOM capture and then runs the existing M2 auth/data marker validation.

## Verification

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "preview up|M2 smoke|preview smoke capture"
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts
```

Both focused checks passed after the implementation.
