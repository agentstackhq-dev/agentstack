# Workflows

Use feature-first generation for new product capabilities:

```bash
agentstack add feature invoices --surfaces web,mobile --backend convex
agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10
```

The commands create coordinated anchors across domain, Convex, web, mobile, telemetry, and `docs/agentstack/`. Start there instead of manually creating disconnected files in each surface. For runnable behavior, mirror the generated `workspace status` path: shared domain contract, Convex boundary, web/mobile surfaces, and unstyled `@app/ui` primitive metadata.

Use a tight validation loop after generation and while changing product code:

1. Add the feature with `agentstack add feature <name> --surfaces web,mobile --backend convex`.
2. Add plan anchors with `agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10` before writing surface-specific gating code.
3. Fill in the generated domain, backend, surface, telemetry, feature-doc, and billing-plan anchors. Use `workspace status` as the smallest accepted vertical-slice shape.
4. Run `pnpm run validate`.
5. Run `pnpm run env:inspect` when provider state or environment bindings are involved.
6. Use `agentstack env set --env preview --surface <surface> --name <name> --value <value>` for local validation state only when required custom env values are missing.
7. Run `pnpm run preview:plan` before applying local-cloud preview state.
8. Run `pnpm run preview:apply` to reconcile linked services and local provider env resource rehearsal into `.agentstack/local-cloud.json`; sync refuses to plan or apply provider env resources until declared values are present and valid.
9. Run `pnpm run provider:clerk:inspect:preview`, `pnpm run provider:convex:inspect:preview`, or `pnpm run provider:eas:inspect:preview` when provider diagnostics are required. These are explicit provider reads, not plan/sync/deploy side effects; EAS inspect runs only preview `env:list`.
10. Run `pnpm run provider:convex:apply:preview` only when you want explicit Convex preview provider execution. Run `pnpm run provider:vercel:apply:preview` only when you want explicit Vercel preview deploy execution. Supported apply paths print `Evidence: live-mutation` and require a matching `planned` or `active` provider ledger row before the executor runs. Clerk apply, EAS apply, Vercel production apply, Vercel env mutation execution, and EAS build/init/env mutation execution are unavailable; production Convex apply requires `--confirm-production`.
11. Run `pnpm run preview:validate` before rehearsing a preview deploy. It checks linked services plus provider env resource presence and drift without reading raw env values from local-cloud state, and prints `Evidence: local-rehearsal` plus `Scope: local-cloud state only; no live provider reads`.
12. Run `pnpm run preview:deploy` to plan the local preview deploy rehearsal.
13. Run `pnpm run preview:deploy:apply` only when you want `.agentstack/deployments/preview.json` written.
14. Run `pnpm run mobile:build:preview` to plan the local mobile build rehearsal.
15. Run `pnpm run mobile:build:preview:apply` only when you want `.agentstack/builds/mobile-preview.json` written.
16. Inspect behavior with `pnpm run observe:timeline`, `node scripts/agentstack.mjs observe timeline --env development --journey billing`, or `node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build` when billing plans, events, jobs, or cloud state are involved.
17. Re-run validation before handing work off.

The preview deploy and mobile build workflows are local-only. They rehearse the Agentstack path and write local-cloud state; they do not deploy to Vercel or submit EAS builds as side effects. `.agentstack/local-cloud.json` sync links are simulator state and are not proof of external provider existence. Local provider env resource rehearsal stores redacted/hash-only metadata, never raw environment values. Provider inventory/link/adopt are also local control-plane workflows in this slice: inventory prints `Evidence: local-inventory` or `Evidence: ledger-local-inventory`, link writes only `.agentstack/provider-links.json` after a matching planned or active ledger row, and adopt is print-only direct-command documentation only. Generated package scripts expose inventory/link but not adopt because adopt requires operator-specific external ID, owner, purpose, creation, cleanup, and evidence fields. Provider execution happens only through explicit `agentstack provider inspect/apply`: provider plan prints `Evidence: provider-command-plan`, Clerk inspect and EAS preview inspect print `Evidence: live-read`, Convex apply and Vercel preview apply print `Evidence: live-mutation`, and supported mutations are ledger-gated before execution.
