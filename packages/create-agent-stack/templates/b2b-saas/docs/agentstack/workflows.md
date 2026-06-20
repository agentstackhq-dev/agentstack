# Workflows

Use feature-first generation for new product capabilities:

```bash
agentstack add feature invoices --surfaces web,mobile --backend convex
agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10
```

The commands create coordinated anchors across domain, Convex, web, mobile, telemetry, and `docs/agentstack/`. Start there instead of manually creating disconnected files in each surface.

Use a tight validation loop after generation and while changing product code:

1. Add the feature with `agentstack add feature <name> --surfaces web,mobile --backend convex`.
2. Add plan anchors with `agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10` before writing surface-specific gating code.
3. Fill in the generated domain, backend, surface, telemetry, feature-doc, and billing-plan anchors.
4. Run `pnpm run validate`.
5. Run `pnpm run env:inspect` when provider state or environment bindings are involved.
6. Run `pnpm run preview:plan` before applying local-cloud preview state.
7. Run `pnpm run preview:apply` and `pnpm run preview:validate` before rehearsing a preview deploy.
8. Run `pnpm run preview:deploy` to plan the local preview deploy rehearsal.
9. Run `pnpm run preview:deploy:apply` only when you want `.agentstack/deployments/preview.json` written.
10. Run `pnpm run mobile:build:preview` to plan the local mobile build rehearsal.
11. Run `pnpm run mobile:build:preview:apply` only when you want `.agentstack/builds/mobile-preview.json` written.
12. Inspect behavior with `pnpm run observe:timeline`, `node scripts/agentstack.mjs observe timeline --env development --journey billing`, or `node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build` when billing plans, events, jobs, or cloud state are involved.
13. Re-run validation before handing work off.

The preview deploy and mobile build workflows are local-only. They rehearse the Agentstack path and write local-cloud state; they do not deploy to real providers or submit EAS builds.
