# Workflows

Use feature-first generation for new product capabilities:

```bash
agentstack add feature invoices --surfaces web,mobile --backend convex
```

The command creates coordinated anchors across domain, Convex, web, mobile, telemetry, and `docs/agentstack/features/`. Start there instead of manually creating disconnected files in each surface.

Use a tight validation loop after generation and while changing product code:

1. Add the feature with `agentstack add feature <name> --surfaces web,mobile --backend convex`.
2. Fill in the generated domain, backend, surface, telemetry, and feature-doc anchors.
3. Run `pnpm run validate`.
4. Run `pnpm run env:inspect` when provider state or environment bindings are involved.
5. Run `pnpm run preview:plan` before applying local-cloud preview state.
6. Run `pnpm run preview:apply` and `pnpm run preview:validate` before rehearsing a preview deploy.
7. Run `pnpm run preview:deploy` to plan the local preview deploy rehearsal.
8. Run `pnpm run preview:deploy:apply` only when you want `.agentstack/deployments/preview.json` written.
9. Inspect behavior with `pnpm run observe:timeline` or `node scripts/agentstack.mjs observe timeline --env preview --journey deployment` when events, jobs, or cloud state are involved.
10. Re-run validation before handing work off.

The preview deploy workflow is local-only. It rehearses the Agentstack path and writes local-cloud state; it does not deploy to real providers.
