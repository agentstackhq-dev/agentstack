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
5. Run `pnpm run sync:preview` before applying preview provider changes.
6. Inspect behavior with `pnpm run observe:timeline` when events, jobs, or cloud state are involved.
7. Re-run validation before handing work off.
