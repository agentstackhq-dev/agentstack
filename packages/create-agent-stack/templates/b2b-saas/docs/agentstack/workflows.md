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
9. Run `pnpm run mobile:build:preview` to plan the local mobile build rehearsal.
10. Run `pnpm run mobile:build:preview:apply` only when you want `.agentstack/builds/mobile-preview.json` written.
11. Inspect behavior with `pnpm run observe:timeline` or `node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build` when events, jobs, or cloud state are involved.
12. Re-run validation before handing work off.

The preview deploy and mobile build workflows are local-only. They rehearse the Agentstack path and write local-cloud state; they do not deploy to real providers or submit EAS builds.
