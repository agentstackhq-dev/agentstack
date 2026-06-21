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
4. Run `pnpm run validate` for `Evidence: local-structure`.
5. Run `pnpm run validate:quality` when code changed for `Evidence: local-quality`; it runs `pnpm typecheck` and `pnpm test` only and must not write local-cloud state or call provider executors.
6. Run `pnpm run env:inspect` when provider state or environment bindings are involved.
7. Use `agentstack env set --env preview --surface <surface> --name <name> --value <value>` for local validation state only when required custom env values are missing.
8. Run `pnpm run preview:plan` before applying local-cloud preview state.
9. Run `pnpm run preview:apply` to reconcile linked services and local provider env resource rehearsal into `.agentstack/local-cloud.json`; sync refuses to plan or apply provider env resources until declared values are present and valid.
10. Run `pnpm run provider:clerk:inspect:preview`, `pnpm run provider:convex:inspect:preview`, or `pnpm run provider:eas:inspect:preview` when provider diagnostics are required. These are explicit provider reads, not plan/sync/deploy side effects; EAS inspect runs only preview `env:list`.
11. Run `pnpm run provider:convex:apply:preview` only when you want explicit Convex preview provider execution. Run `pnpm run provider:vercel:apply:preview` only when you want explicit Vercel preview deploy execution. Supported apply paths print `Evidence: live-mutation` and require a matching `planned` or `active` provider ledger row before the executor runs. Clerk apply, EAS apply, Vercel production apply, Vercel env mutation execution, and EAS build/init/env mutation execution are unavailable; production Convex apply requires `--confirm-production`.
12. Run `pnpm run preview:validate` before rehearsing a preview deploy. It checks linked services plus provider env resource presence and drift without reading raw env values from local-cloud state, and prints `Evidence: local-rehearsal` plus `Scope: local-cloud state only; no live provider reads`. This is local-cloud rehearsal, not live provider proof.
13. Run `pnpm run preview:deploy` to plan the local preview deploy rehearsal.
14. Run `pnpm run preview:deploy:apply` only when you want `.agentstack/deployments/preview.json` written.
15. Run `pnpm run mobile:build:preview` to plan the local mobile build rehearsal.
16. Run `pnpm run mobile:build:preview:apply` only when you want `.agentstack/builds/mobile-preview.json` written.
17. Inspect behavior with `pnpm run observe:timeline`, `node scripts/agentstack.mjs observe timeline --env development --journey billing`, or `node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build` when billing plans, events, jobs, or cloud state are involved.
18. Run `pnpm run validate:live:preview` only when read-only live provider evidence is required. This aggregate live validation refuses readiness today because exact identity proof is not implemented.
19. Re-run structural validation, and re-run quality validation when code changed, before handing work off.

Validation evidence categories are intentionally separate: `local-structure` for generated project shape, `local-quality` for local package commands, `local-rehearsal` for local-cloud rehearsal state, `live-validation` for aggregate bounded read-only provider validation, and `live-read-inventory` for per-provider inventory reads. The preview deploy and mobile build workflows are local-only. They rehearse the Agentstack path and write local-cloud state; they do not deploy to Vercel or submit EAS builds as side effects. `.agentstack/local-cloud.json` sync links are simulator state and are not proof of external provider existence. Live validation refuses readiness today with `Readiness: refused` because exact provider identity proof is not implemented. Local provider env resource rehearsal stores redacted/hash-only metadata, never raw environment values. Provider inventory defaults to local control-plane evidence with `Evidence: local-inventory` or `Evidence: ledger-local-inventory` and writes no files; explicit live inventory uses `--source live` or `--live`, calls only bounded read-only inspect primitives, prints `Evidence: live-read-inventory`, keeps `identity=ambiguous`, and prints sanitized `missing=` identity proof labels when exact confirmation is unavailable. Provider link writes only `.agentstack/provider-links.json` after a matching planned or active ledger row, and adopt is print-only direct-command documentation only and writes no files; live link/adopt refusals add a sanitized `Identity proof requirements:` summary and still write nothing. Generated package scripts expose inventory/link but not adopt because adopt requires operator-specific external ID, owner, purpose, creation, cleanup, and evidence fields. Provider execution happens only through explicit `agentstack provider inspect/apply`: provider plan prints `Evidence: provider-command-plan`, Clerk inspect plus Vercel and EAS preview inspect print `Evidence: live-read`, Convex apply and Vercel preview apply print `Evidence: live-mutation`, and supported mutations are ledger-gated before execution.
