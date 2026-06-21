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
6. Use `agentstack env set --env preview --surface <surface> --name <name> --value <value>` for local validation state only when required custom env values are missing.
7. Run `pnpm run preview:plan` before applying local-cloud preview state.
8. Run `pnpm run preview:apply` to reconcile linked services and local provider env resource rehearsal into `.agentstack/local-cloud.json`; sync refuses to plan or apply provider env resources until declared values are present and valid.
9. Run `pnpm run preview:validate` before rehearsing a preview deploy. It checks linked services plus provider env resource presence and drift without reading raw env values from local-cloud state.
10. Run `pnpm run preview:deploy` to plan the local preview deploy rehearsal.
11. Run `pnpm run preview:deploy:apply` only when you want `.agentstack/deployments/preview.json` written.
12. Run `pnpm run mobile:build:preview` to plan the local mobile build rehearsal.
13. Run `pnpm run mobile:build:preview:apply` only when you want `.agentstack/builds/mobile-preview.json` written.
14. Inspect behavior with `pnpm run observe:timeline`, `node scripts/agentstack.mjs observe timeline --env development --journey billing`, or `node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build` when billing plans, events, jobs, or cloud state are involved.
15. Re-run validation before handing work off.

The preview deploy and mobile build workflows are local-only. They rehearse the Agentstack path and write local-cloud state; they do not deploy to real providers or submit EAS builds. Local provider env resource rehearsal stores redacted/hash-only metadata, never raw environment values. Clerk, Convex, Vercel, and EAS command-plan adapters read the same resource contract that future provider apply automation will mutate.
