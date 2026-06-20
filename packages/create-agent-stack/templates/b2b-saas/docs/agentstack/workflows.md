# Workflows

Use a tight validation loop while changing product code:

1. Edit the relevant app, package, or Convex surface.
2. Run `pnpm run validate`.
3. Run `pnpm run env:inspect` when provider state or environment bindings are involved.
4. Run `pnpm run sync:preview` before applying preview provider changes.
5. Inspect behavior with `pnpm run observe:timeline` when events, jobs, or cloud state are involved.
6. Re-run validation before handing work off.
