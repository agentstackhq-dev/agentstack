# Workflows

- Inspect: run `pnpm run inspect`, then `pnpm run skills:inspect` when agent guidance is relevant.
- Validate: run `pnpm run validate` before completion for `Evidence: local-structure`; run `pnpm run validate:quality` before completion when code changed for `Evidence: local-quality`.
- Cloud rehearsal: run `pnpm run preview:validate` for local-cloud rehearsal only; it prints `Evidence: local-rehearsal` and does not prove live provider state.
- Live validation: run `pnpm run validate:live:preview` only for aggregate bounded read-only provider inventory. It prints `Evidence: live-validation`, refuses readiness, and writes no telemetry, local-cloud, provider-links, ledger, or provider resources.
- Live provider inventory: use `--source live` or `--live` only for bounded read-only evidence. `missing=` labels and live link/adopt requirement summaries are sanitized proof blockers; identity remains ambiguous.
- Provider proof: use `provider proof --service <service> --env preview --resource-type <type> --name <name>` for preview ledger-gated proof checks, plus Clerk-only production application proof when a matching production ledger row exists. It may run bounded read-only inventory, never reads local-cloud state, and writes nothing. Only narrow Clerk preview/production application proof and bounded Vercel preview project proof can emit sanitized exact identity today; live coherence remains blocked/unavailable, and readiness/link/adopt/mutation stay refused/unauthorized.
- Preview: rehearse sync with `pnpm run preview:plan`, then apply with `pnpm run preview:apply` only when requested.
- Deploy: rehearse deploys with `pnpm run preview:deploy`; use `pnpm run preview:deploy:apply` for local apply artifacts.
- Mobile: use the generated mobile build scripts and treat `.agentstack/builds/` as local rehearsal output.
