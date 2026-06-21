# Agentstack Slice 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Agentstack beyond the first prototype by making the local command contract look like the real end-to-end framework lifecycle: manifest-driven env inspection, provider lifecycle planning, environment-aware cloud validation, telemetry timelines, and stronger generated app anchors.

**Architecture:** Keep this slice fully local and deterministic. Core compiles manifest intent into an environment graph, adapters inspect and reconcile local provider state, the CLI orchestrates commands and emits telemetry, and templates expose the workflow to generated projects. Real Convex, Clerk, Vercel, and EAS API calls remain future adapters behind the same lifecycle contracts.

**Tech Stack:** TypeScript, Node.js ESM, pnpm workspaces, Vitest, Zod, JSONL telemetry, filesystem-backed local-cloud adapter.

---

## File Structure

- Modify `packages/core/src/manifest.ts`: add manifest version/guidance metadata, provider service config, telemetry environment policy, and generated anchor declarations.
- Modify `packages/core/src/env-graph.ts`: compile environment/service/surface/custom-env expectations and validate enum-style custom env values.
- Modify `packages/core/src/validation.ts`: validate declared generated anchors, service/env coherence, telemetry policy, and generated guidance version.
- Modify `packages/adapters/src/types.ts`: expand cloud adapter lifecycle around inspect, plan, apply, validate.
- Modify `packages/adapters/src/local-cloud.ts`: store normalized service resources and support inspect/plan/apply while preserving current sync behavior.
- Modify `packages/telemetry/src/events.ts` and `packages/telemetry/src/store.ts`: add component/schema fields and timeline-friendly query helpers.
- Modify `packages/cli/src/run.ts`: add `env inspect`, environment-aware `validate --cloud --env`, command telemetry, and `observe timeline`.
- Modify `packages/cli/src/run.test.ts`, `packages/core/src/*.test.ts`, `packages/adapters/src/*.test.ts`, `packages/telemetry/src/*.test.ts`, `tests/e2e/prototype.test.ts`: prove the local lifecycle.
- Modify `templates/b2b-saas` and `packages/create-agent-stack/templates/b2b-saas`: add docs, anchors, root scripts, `.env.example`, package manifests, and minimal source anchors for web/mobile/Convex/shared packages.
- Modify `packages/create-agent-stack/src/generate.test.ts`: assert new anchors and mirror parity.
- Modify `README.md` and `docs/spinup-site` if command semantics change.

## Task 1: Core Manifest And Env Graph

**Files:**
- Modify: `packages/core/src/manifest.ts`
- Modify: `packages/core/src/env-graph.ts`
- Modify: `packages/core/src/validation.ts`
- Modify tests: `packages/core/src/manifest.test.ts`, `packages/core/src/env-graph.test.ts`, `packages/core/src/validation.test.ts`

- [ ] Add `frameworkVersion`, `guidanceVersion`, per-service provider config, telemetry environment policy, and `generated.requiredAnchors` to the manifest schema.
- [ ] Keep old generated manifests valid only if migration defaults are intentionally provided; otherwise update tests and templates together.
- [ ] Add enum validation for declarations like `"enum:sandbox,live"` in `env.custom.*.validate`.
- [ ] Add env graph output that includes expected service nodes and env bindings by environment/surface.
- [ ] Run `pnpm test packages/core/src/manifest.test.ts packages/core/src/env-graph.test.ts packages/core/src/validation.test.ts`.

## Task 2: Adapter Lifecycle

**Files:**
- Modify: `packages/adapters/src/types.ts`
- Modify: `packages/adapters/src/local-cloud.ts`
- Modify tests: `packages/adapters/src/local-cloud.test.ts`

- [ ] Introduce normalized lifecycle types: inspect report, sync plan, sync change, and applied plan.
- [ ] Support `inspect(manifest, environment)` for linked, missing, stale, and expected service resources.
- [ ] Preserve `validate()` and `sync()` compatibility for the CLI while internally using inspect/plan/apply semantics.
- [ ] Keep production mutations explicit; plan mode must not write state.
- [ ] Run `pnpm test packages/adapters/src/local-cloud.test.ts`.

## Task 3: Telemetry Timelines

**Files:**
- Modify: `packages/telemetry/src/events.ts`
- Modify: `packages/telemetry/src/store.ts`
- Modify tests: `packages/telemetry/src/events.test.ts`

- [ ] Add optional `schemaVersion`, `component`, `command`, and `status` fields to wide events.
- [ ] Add `timeline(query)` that returns redacted events sorted by timestamp with the same filters as `query`.
- [ ] Keep redaction strict for actor ids, secret-like fields, and token/email/key values.
- [ ] Run `pnpm test packages/telemetry/src/events.test.ts`.

## Task 4: CLI Lifecycle Commands

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify tests: `packages/cli/src/run.test.ts`

- [ ] Add `agentstack env inspect --env preview` with service and env-binding output.
- [ ] Add `agentstack validate --cloud --env <environment>` while preserving preview as the default.
- [ ] Add `agentstack observe timeline --journey <journey> --env <environment>`.
- [ ] Emit local framework telemetry for validate, sync, env inspect, and observe commands.
- [ ] Run `pnpm test packages/cli/src/run.test.ts`.

## Task 5: Generated App Anchors And Docs

**Files:**
- Modify: `templates/b2b-saas/**`
- Modify: `packages/create-agent-stack/templates/b2b-saas/**`
- Modify tests: `packages/create-agent-stack/src/generate.test.ts`

- [ ] Add generated root scripts for `env:inspect`, `preview:plan`, `preview:apply`, and `observe:timeline`.
- [ ] Add `.env.example`, `docs/agentstack/auth.md`, `docs/agentstack/billing.md`, and richer docs for env inspect, sync plan/apply, and telemetry timelines.
- [ ] Add package anchors for `packages/config`, `packages/ui`, and `packages/agentstack-runtime`.
- [ ] Add minimal source anchors for web, mobile, and Convex so agents see where real product code belongs.
- [ ] Keep root and package-local templates byte-identical.
- [ ] Run `pnpm test packages/create-agent-stack/src/generate.test.ts` and `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas`.

## Task 6: E2E And Docs Integration

**Files:**
- Modify: `tests/e2e/prototype.test.ts`
- Modify: `README.md`
- Modify: `docs/spinup-site/*.html` if needed

- [ ] Extend the e2e test to prove: generate, validate, env inspect, sync plan, sync apply, validate cloud by env, and observe a command timeline.
- [ ] Update README smoke commands with the new lifecycle.
- [ ] Update the spin-up site only if its command descriptions become stale.
- [ ] Run `pnpm typecheck`, `pnpm test`, and template mirror diff.

## Definition Of Done

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` has no output.
- Generated app workflow proves the command lifecycle locally.
- Docs describe the command surface that tests actually exercise.
