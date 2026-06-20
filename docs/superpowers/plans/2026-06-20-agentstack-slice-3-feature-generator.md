# Agentstack Slice 3 Feature Generator Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first feature-first command: `agentstack add feature <name> --surfaces web,mobile --backend convex`, generating typed product anchors across domain, Convex, web, mobile, telemetry, and docs.

**Architecture:** Keep the generated repo surface-first, but let agents work feature-first through the CLI. Core owns feature naming, path planning, and generated file contents. The CLI validates options, writes files deterministically, refuses unsafe overwrites, and emits command telemetry. Generated docs teach agents to use the command instead of manually creating disconnected surface files.

**Tech Stack:** TypeScript, Node.js ESM, pnpm workspaces, Vitest, filesystem writes.

---

## File Structure

- Create `packages/core/src/features.ts`: feature name parsing, slug/title/camel helpers, feature file plan, and file content builders.
- Modify `packages/core/src/index.ts`: export feature helpers.
- Add `packages/core/src/features.test.ts`: feature name, path, content, and invalid input tests.
- Modify `packages/cli/src/run.ts`: add `agentstack add feature`.
- Modify `packages/cli/src/run.test.ts`: command validation, generated file writes, no-overwrite behavior, and command telemetry.
- Modify `tests/e2e/prototype.test.ts`: generated project runs add-feature and validates afterward.
- Modify template docs in both template mirrors: `docs/agentstack/workflows.md`, `generated-boundaries.md`, and `local-development.md`.
- Modify `README.md` and spin-up site workflow/generated-app pages.

## Command Contract

```bash
agentstack add feature invoices --surfaces web,mobile --backend convex
```

Generated files:

```txt
packages/domain/src/features/invoices.ts
convex/features/invoices.ts
apps/web/src/features/invoices.ts
apps/mobile/src/features/invoices.ts
packages/telemetry/src/features/invoices.ts
docs/agentstack/features/invoices.md
```

Feature names must produce a lowercase slug with letters or numbers. Existing files are never overwritten. Unsupported surfaces or backend values fail with actionable diagnostics.

## Definition Of Done

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` has no output.
- E2E proves: generate, add feature, validate, env inspect, sync plan/apply, cloud validate, observe timeline.
