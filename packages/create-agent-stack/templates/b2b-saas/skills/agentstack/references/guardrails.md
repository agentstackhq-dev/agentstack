# Guardrails

- Keep generated vendor glue and provider adapters unchanged unless the task explicitly owns them.
- Add app-specific env values through `agentstack.config.json`; do not hardcode provider state.
- Use `@app/theme`, `@app/ui`, `@app/telemetry`, and `packages/domain/src/saas-spine.ts` before duplicating shared logic.
- Treat general preview, deploy, and mobile commands as local rehearsals in this prototype. M1 preview helpers are the exception: `m1:providers:bootstrap` is explicit live provider create/reuse/link setup for Clerk, Convex, and Vercel, `m1:preview:deploy` is explicit live mutation after active ledger/link prerequisites and prints `Provider mutation: convex preview apply, vercel preview deploy`, and `m1:auth:user` is explicit Clerk smoke-user lifecycle mutation after confirmation.
- Treat live inventory `missing=` labels, provider proof `Live coherence: blocked|unavailable` diagnostics, and live link/adopt `Identity proof requirements:` summaries as sanitized blockers only. They do not prove exact provider identity or readiness.
- Preserve docs under `docs/agentstack/` as the human-readable source for generated conventions.
