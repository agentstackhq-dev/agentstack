# Agentstack SaaS Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generated B2B SaaS app include a typed, validated SaaS spine for Clerk identity, Convex authorization, billing state, entitlements, webhook ingestion, and audit events.

**Architecture:** Core owns the required anchor list and reusable SaaS-spine metadata. The generated template owns application-facing domain helpers, Convex metadata anchors, and docs. CLI validation remains file/shape oriented in this slice so future provider adapters can add cloud checks without changing the generated app contract.

**Tech Stack:** TypeScript, Vitest, Convex/Clerk-oriented generated metadata, existing Agentstack manifest and validation APIs.

---

## File Structure

- Create `packages/core/src/saas-spine.ts`: framework-owned list of SaaS spine anchors and metadata names that local validation can require when Clerk and Convex are enabled.
- Create `packages/core/src/saas-spine.test.ts`: unit tests for the new core anchor logic.
- Modify `packages/core/src/validation.ts`: include SaaS spine anchors in `getRequiredGeneratedAnchors`.
- Modify `packages/core/src/index.ts`: export the SaaS spine module.
- Modify `packages/core/src/validation.test.ts`: assert the default generated project requires SaaS spine anchors and that missing anchors fail validation.
- Modify `packages/cli/src/run.test.ts`: update the test fixture generated anchors so CLI validation tests still represent a valid generated project.
- Create `templates/b2b-saas/packages/domain/src/saas-spine.ts`: generated role, permission, billing plan, entitlement, webhook, and audit helpers for app code.
- Modify `templates/b2b-saas/packages/domain/src/index.ts`: re-export `saas-spine.ts`.
- Create `templates/b2b-saas/convex/saasSpine.ts`: generated Convex-side table, webhook, audit, and mutation metadata anchors.
- Modify `templates/b2b-saas/convex/agentstack.ts`: import and expose Convex SaaS spine metadata.
- Modify `templates/b2b-saas/convex/schema.ts`: expose schema table names for the SaaS spine.
- Create `templates/b2b-saas/docs/agentstack/saas-spine.md`: generated docs for the core SaaS spine.
- Modify `templates/b2b-saas/docs/agentstack/auth.md`: point agents to the typed role/membership helpers.
- Modify `templates/b2b-saas/docs/agentstack/billing.md`: point agents to billing plans and entitlement helpers.
- Modify `templates/b2b-saas/AGENTS.md`: tell agents to use SaaS spine helpers before ad hoc auth/billing code.
- Modify `templates/b2b-saas/agentstack.config.json`: add SaaS spine files to generated required anchors.
- Mirror the same generated template edits under `packages/create-agent-stack/templates/b2b-saas/`.
- Modify `packages/create-agent-stack/src/generate.test.ts`: assert generation includes the SaaS spine files and content.
- Modify `tests/e2e/prototype.test.ts`: assert the generated app validates and exposes SaaS spine anchors through the executable workflow.
- Modify `README.md` and `docs/spinup-site/generated-app.html`: explain the new generated SaaS spine for internal spin-up.

## Task 1: Core Anchor Contract

**Files:**
- Create: `packages/core/src/saas-spine.ts`
- Create: `packages/core/src/saas-spine.test.ts`
- Modify: `packages/core/src/validation.ts`
- Modify: `packages/core/src/validation.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that expect the default manifest to require these anchors:

```ts
expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
  expect.arrayContaining([
    "docs/agentstack/saas-spine.md",
    "packages/domain/src/saas-spine.ts",
    "convex/saasSpine.ts"
  ])
);
```

Also add a focused `packages/core/src/saas-spine.test.ts` test:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { getSaasSpineGeneratedAnchors, hasManagedSaasSpine } from "./saas-spine.js";

describe("saas spine anchors", () => {
  it("requires generated SaaS spine files when Clerk and Convex are enabled", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(hasManagedSaasSpine(manifest)).toBe(true);
    expect(getSaasSpineGeneratedAnchors(manifest)).toEqual([
      "docs/agentstack/saas-spine.md",
      "packages/domain/src/saas-spine.ts",
      "convex/saasSpine.ts"
    ]);
  });

  it("does not require the generated SaaS spine when Clerk is disabled", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.clerk.enabled = false;

    expect(hasManagedSaasSpine(manifest)).toBe(false);
    expect(getSaasSpineGeneratedAnchors(manifest)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/core/src/saas-spine.test.ts packages/core/src/validation.test.ts
```

Expected: fail because `./saas-spine.js` does not exist and validation does not require the anchors yet.

- [ ] **Step 3: Implement core logic**

Create `packages/core/src/saas-spine.ts`:

```ts
import type { AgentstackManifest } from "./manifest.js";

export const saasSpineGeneratedAnchors = [
  "docs/agentstack/saas-spine.md",
  "packages/domain/src/saas-spine.ts",
  "convex/saasSpine.ts"
] as const;

export type SaasSpineGeneratedAnchor = (typeof saasSpineGeneratedAnchors)[number];

export function hasManagedSaasSpine(manifest: AgentstackManifest): boolean {
  return manifest.services.clerk.enabled && manifest.services.convex.enabled;
}

export function getSaasSpineGeneratedAnchors(
  manifest: AgentstackManifest
): SaasSpineGeneratedAnchor[] {
  return hasManagedSaasSpine(manifest) ? [...saasSpineGeneratedAnchors] : [];
}
```

Modify `validation.ts`:

```ts
import { getSaasSpineGeneratedAnchors } from "./saas-spine.js";
```

Then append SaaS spine anchors in `getRequiredGeneratedAnchors`:

```ts
anchors.push(...getSaasSpineGeneratedAnchors(manifest));
```

Modify `index.ts`:

```ts
export * from "./saas-spine.js";
```

Update the `writeGeneratedAnchors` helper in `packages/cli/src/run.test.ts` so its temporary generated project includes `packages/domain/src/saas-spine.ts`, `convex/saasSpine.ts`, and `docs/agentstack/saas-spine.md`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run packages/core/src/saas-spine.test.ts packages/core/src/validation.test.ts packages/cli/src/run.test.ts
```

Expected: pass.

## Task 2: Generated Template SaaS Spine

**Files:**
- Create: `templates/b2b-saas/packages/domain/src/saas-spine.ts`
- Modify: `templates/b2b-saas/packages/domain/src/index.ts`
- Create: `templates/b2b-saas/convex/saasSpine.ts`
- Modify: `templates/b2b-saas/convex/agentstack.ts`
- Modify: `templates/b2b-saas/convex/schema.ts`
- Create: `templates/b2b-saas/docs/agentstack/saas-spine.md`
- Modify: `templates/b2b-saas/docs/agentstack/auth.md`
- Modify: `templates/b2b-saas/docs/agentstack/billing.md`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/agentstack.config.json`
- Mirror all template changes under `packages/create-agent-stack/templates/b2b-saas/`
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/create-agent-stack/src/generate.test.ts`, add expectations after generation:

```ts
await expect(readFile(join(targetDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
  "agentstackBillingPlans"
);
await expect(readFile(join(targetDir, "packages/domain/src/index.ts"), "utf8")).resolves.toContain(
  "./saas-spine.js"
);
await expect(readFile(join(targetDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
  "agentstackSaasTables"
);
await expect(readFile(join(targetDir, "docs/agentstack/saas-spine.md"), "utf8")).resolves.toContain(
  "Core SaaS Spine"
);
expect(manifest.generated.requiredAnchors).toEqual(
  expect.arrayContaining([
    "packages/domain/src/saas-spine.ts",
    "convex/saasSpine.ts",
    "docs/agentstack/saas-spine.md"
  ])
);
```

Add the same three paths to the `generatedAnchorFiles` array.

In `tests/e2e/prototype.test.ts`, after `generateProject`, read the generated domain and Convex files and assert:

```ts
await expect(readFile(join(appDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
  "planHasEntitlement"
);
await expect(readFile(join(appDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
  "clerkWebhookTypes"
);
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
```

Expected: fail because the generated files do not exist and the manifest does not list them.

- [ ] **Step 3: Add generated domain spine**

Create `packages/domain/src/saas-spine.ts` with these exported contracts:

```ts
export type AgentstackRole = "owner" | "admin" | "member";
export type AgentstackPermission =
  | "org.manage"
  | "members.manage"
  | "billing.manage"
  | "feature.use"
  | "audit.read";
export type AgentstackBillingPlan = "free" | "pro";
export type AgentstackEntitlement =
  | "seats.included"
  | "feature.auditLog"
  | "feature.advancedReports";
export type AgentstackWebhookType =
  | "clerk.user.created"
  | "clerk.organization.created"
  | "clerk.organizationMembership.created"
  | "clerk.billing.subscription.updated";
export type AgentstackAuditEventType =
  | "auth.user.linked"
  | "org.member.added"
  | "billing.subscription.synced"
  | "entitlement.granted";
```

Export `agentstackRoles`, `agentstackBillingPlans`, `agentstackWebhookTypes`, `agentstackAuditEventTypes`, `roleHasPermission`, and `planHasEntitlement`. Use readonly arrays and strict literal types.

Modify `packages/domain/src/index.ts`:

```ts
export * from "./saas-spine.js";
```

- [ ] **Step 4: Add generated Convex spine**

Create `convex/saasSpine.ts` with:

```ts
export const agentstackSaasTables = [
  "users",
  "identities",
  "orgs",
  "memberships",
  "roles",
  "billingSubscriptions",
  "entitlements",
  "webhookEvents",
  "auditEvents"
] as const;

export const clerkWebhookTypes = [
  "clerk.user.created",
  "clerk.organization.created",
  "clerk.organizationMembership.created",
  "clerk.billing.subscription.updated"
] as const;
```

Also export `agentstackAuditEventTypes` and `agentstackSaasSpine` metadata that references all three arrays.

Modify `convex/agentstack.ts` to import and expose `agentstackSaasSpine`.

Modify `convex/schema.ts` to export `agentstackSaasSchemaTables` with the same table names. Superseded: `convex/schema.ts` now materializes the runnable workspace-status slice and current generated runtime schema.

- [ ] **Step 5: Add generated docs and manifest anchors**

Create `docs/agentstack/saas-spine.md` describing:

- domain helpers at `packages/domain/src/saas-spine.ts`;
- Convex metadata at `convex/saasSpine.ts`;
- required tables: users, identities, orgs, memberships, roles, billingSubscriptions, entitlements, webhookEvents, auditEvents;
- how agents should use `roleHasPermission` and `planHasEntitlement`;
- the rule that provider wiring remains behind generated wrappers.

Update `auth.md`, `billing.md`, and `AGENTS.md` to point agents at the SaaS spine.

Update `agentstack.config.json` `generated.requiredAnchors` with the three new files.

Copy every changed template file from `templates/b2b-saas` to `packages/create-agent-stack/templates/b2b-saas`.

- [ ] **Step 6: Run GREEN**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
```

Expected: pass.

## Task 3: Internal Spin-Up Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/spinup-site/generated-app.html`
- Optional modify: `docs/spinup-site/assets/site.js` if the lab scenario list should include SaaS spine validation.

- [ ] **Step 1: Write the failing check**

Use a shell check before editing:

```bash
rg "SaaS spine|Core SaaS Spine|packages/domain/src/saas-spine.ts" README.md docs/spinup-site/generated-app.html
```

Expected: no relevant matches before this task.

- [ ] **Step 2: Update docs**

Add a README command/description bullet for the generated SaaS spine:

```md
- Generated apps include a typed SaaS spine in `packages/domain/src/saas-spine.ts`, `convex/saasSpine.ts`, and `docs/agentstack/saas-spine.md` for roles, memberships, billing plans, entitlements, Clerk webhooks, and audit events.
```

Add one generated-app card and one section showing how the domain, Convex, docs, and validation anchors connect.

- [ ] **Step 3: Run docs check**

Run:

```bash
rg "SaaS spine|Core SaaS Spine|packages/domain/src/saas-spine.ts" README.md docs/spinup-site/generated-app.html
```

Expected: matches in both files.

## Final Verification

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas`.
- [ ] Run `git diff --check`.
- [ ] Run a generated app smoke if the test suite did not already exercise generation and validation:

```bash
rm -rf tmp/acme-crm
mkdir -p tmp
pnpm tsx packages/create-agent-stack/src/bin.ts tmp/acme-crm
cd tmp/acme-crm
AGENTSTACK_CLI_BIN=../../packages/cli/src/bin.ts AGENTSTACK_TSX_BIN=../../node_modules/.bin/tsx pnpm run validate
```

- [ ] Commit with message `feat: add generated saas spine`.
