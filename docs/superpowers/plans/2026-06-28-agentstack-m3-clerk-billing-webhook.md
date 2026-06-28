# Agentstack M3 Clerk Billing Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove M3 by driving a lean generated Agentstack app through Clerk Billing webhook delivery, Convex entitlement updates, and a preview web feature gate for `feature.auditLog`.

**Architecture:** The generated app remains lean. Agentstack package commands own provider setup, fixture lifecycle, smoke checks, and evidence. Clerk Billing webhooks are delivered directly to a Convex HTTP action on `.convex.site`; the Vercel preview app only renders the authenticated UI and reads entitlement state through protected Convex queries.

**Tech Stack:** TypeScript, Zod, pnpm, Vitest, Clerk CLI/API, Clerk Billing, Clerk webhook verification, Convex HTTP actions, Vercel preview deploy, React.

---

## File Structure

- Modify `docs/milestones/M3-billing-webhook.md`: keep acceptance criteria in sync with the implemented path.
- Modify `docs/milestones/README.md`: make M3 the active milestone after M2 completion.
- Modify `AGENTS.md`: update current singular goal to M3, preserving lean-app and ledger rules.
- Modify `packages/core/src/manifest.ts`: add the typed `billing` schema.
- Modify `packages/core/src/manifest.test.ts`: cover valid and invalid M3 billing config.
- Modify `templates/b2b-saas/agentstack.config.ts`: add `billing` and remove `STRIPE_MODE`.
- Mirror template changes under `packages/create-agent-stack/templates/b2b-saas/`.
- Modify `templates/b2b-saas/package.json`: add package scripts for `billing:bootstrap`, `billing:fixture`, and `billing:smoke`.
- Modify `templates/b2b-saas/apps/convex/package.json`: add Clerk webhook verification dependency if the implementation uses `@clerk/backend/webhooks`.
- Create `templates/b2b-saas/apps/convex/convex/http.ts`: expose Clerk Billing webhook route.
- Create `templates/b2b-saas/apps/convex/convex/billing.ts`: entitlement queries/mutations and idempotent event application.
- Modify `templates/b2b-saas/apps/convex/convex/schema.ts`: add billing tables.
- Modify `templates/b2b-saas/apps/web/src/App.tsx`: render the entitlement gate and DOM markers.
- Modify `packages/create-agent-stack/src/generate.test.ts`: enforce lean M3 template shape and script/config expectations.
- Modify `packages/core/src/billing-plans.ts` and `packages/core/src/billing-plans.test.ts`: remove or replace the old generated-anchor billing plan planner that writes `packages/domain`, root `convex`, and generated docs.
- Modify `packages/cli/src/run.ts`: route M3 billing commands.
- Create `packages/cli/src/m3-billing.ts`: package-owned M3 billing bootstrap, fixture, smoke, and evidence helpers.
- Modify `packages/cli/src/run.test.ts`: add command-level tests for M3 billing behavior.
- Modify `packages/cli/src/m2-live.ts` only if shared helpers are extracted; do not couple M3 to M2 names in user-facing output.
- Modify `docs/provider-resource-ledger.md`: append active/cleanup rows only during the live M3 run.
- Create `docs/milestones/evidence/M3-billing-webhook/<run>.md`: redacted live evidence after execution.

## Task 1: M3 Docs And Active Milestone State

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/milestones/README.md`
- Modify: `docs/milestones/M3-billing-webhook.md`

- [ ] **Step 1: Update active milestone docs**

Set `AGENTS.md` and `docs/milestones/README.md` to say M3 is the active milestone, M2 is complete, and M3 implementation must not add generated framework docs/scripts to consumer apps.

- [ ] **Step 2: Verify doc links**

Run:

```bash
rg -n "M2 approach discussion|M3|billing" AGENTS.md docs/milestones/README.md docs/milestones/M3-billing-webhook.md
```

Expected: no stale "M2 approach discussion is the only active goal" text remains.

- [ ] **Step 3: Commit docs baseline**

```bash
git add AGENTS.md docs/milestones/README.md docs/milestones/M3-billing-webhook.md docs/superpowers/specs/2026-06-28-agentstack-m3-clerk-billing-webhook-design.md docs/superpowers/plans/2026-06-28-agentstack-m3-clerk-billing-webhook.md
git commit -m "docs: specify M3 clerk billing webhook plan"
```

## Task 2: Typed Billing Config Schema

**Files:**
- Modify: `packages/core/src/manifest.ts`
- Modify: `packages/core/src/manifest.test.ts`
- Modify: `packages/agentstack/src/config.ts` only if new exported types are needed

- [ ] **Step 1: Write failing schema tests**

Add tests to `packages/core/src/manifest.test.ts`:

```ts
it("accepts Clerk Billing config for the M3 audit log entitlement", () => {
  const manifest = createDefaultManifest("acme-crm");
  const result = parseManifest({
    ...manifest,
    billing: {
      provider: "clerk",
      requiredEnvironments: ["preview", "production"],
      entitlements: {
        "feature.auditLog": {
          providerFeature: "audit_log",
          providerPlan: "agentstack_m3_audit_log",
          scope: "workspace",
          payer: "organization"
        }
      },
      webhook: {
        service: "convex",
        route: "/agentstack/webhooks/clerk/billing",
        events: ["subscriptionItem.active", "subscriptionItem.updated", "subscriptionItem.canceled"]
      }
    }
  });

  expect(result.ok).toBe(true);
});

it("rejects Clerk Billing config when Clerk or Convex is disabled for preview", () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.services.clerk.enabled = false;
  const result = parseManifest({
    ...manifest,
    billing: {
      provider: "clerk",
      requiredEnvironments: ["preview"],
      entitlements: {
        "feature.auditLog": {
          providerFeature: "audit_log",
          providerPlan: "agentstack_m3_audit_log",
          scope: "workspace",
          payer: "organization"
        }
      },
      webhook: {
        service: "convex",
        route: "/agentstack/webhooks/clerk/billing",
        events: ["subscriptionItem.active"]
      }
    }
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "manifest.invalid",
        path: "billing.provider"
      })
    ]);
  }
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm vitest run packages/core/src/manifest.test.ts -t "Clerk Billing"
```

Expected: FAIL because `billing` is not in the schema.

- [ ] **Step 3: Implement schema**

In `packages/core/src/manifest.ts`, add strict schemas for:

```ts
const billingProviderSchema = z.enum(["clerk"]);
const billingScopeSchema = z.enum(["workspace"]);
const billingPayerSchema = z.enum(["organization", "user"]);
const billingEventSchema = z.enum([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.past_due",
  "subscriptionItem.created",
  "subscriptionItem.updated",
  "subscriptionItem.active",
  "subscriptionItem.canceled",
  "subscriptionItem.ended",
  "subscriptionItem.past_due"
]);
```

Add `billing` to `manifestSchema`, `createDefaultManifest()`, and exported types. The default manifest should include
the M3 Clerk Billing config. In `superRefine`, add diagnostics when:

- `billing.provider === "clerk"` and `services.clerk.enabled` is false
- `billing.webhook.service === "convex"` and `services.convex.enabled` is false
- a `billing.requiredEnvironments` entry is missing from either Clerk or Convex required environments

- [ ] **Step 4: Run schema tests**

```bash
pnpm vitest run packages/core/src/manifest.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/manifest.ts packages/core/src/manifest.test.ts packages/agentstack/src/config.ts
git commit -m "feat: add clerk billing config schema"
```

## Task 3: Template Config And Lean Surface

**Files:**
- Modify: `templates/b2b-saas/agentstack.config.ts`
- Modify: `packages/create-agent-stack/templates/b2b-saas/agentstack.config.ts`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [ ] **Step 1: Write failing generator tests**

Add assertions that generated `agentstack.config.ts` contains `billing:`, `"feature.auditLog"`, `providerFeature:
"audit_log"`, and does not contain `STRIPE_MODE`.

Add package script assertions:

```ts
expect(packageJson.scripts["billing:bootstrap"]).toBe("agentstack billing bootstrap");
expect(packageJson.scripts["billing:fixture"]).toBe("agentstack billing fixture");
expect(packageJson.scripts["billing:smoke"]).toBe("agentstack billing smoke");
```

- [ ] **Step 2: Run failing generator tests**

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "M2 lean|billing"
```

Expected: FAIL until template files are updated.

- [ ] **Step 3: Update both template copies**

Remove the `STRIPE_MODE` `env.custom` entry. Add:

```ts
billing: {
  provider: "clerk",
  requiredEnvironments: ["preview", "production"],
  entitlements: {
    "feature.auditLog": {
      providerFeature: "audit_log",
      providerPlan: "agentstack_m3_audit_log",
      scope: "workspace",
      payer: "organization"
    }
  },
  webhook: {
    service: "convex",
    route: "/agentstack/webhooks/clerk/billing",
    events: [
      "subscription.created",
      "subscription.updated",
      "subscription.active",
      "subscription.past_due",
      "subscriptionItem.created",
      "subscriptionItem.updated",
      "subscriptionItem.active",
      "subscriptionItem.canceled",
      "subscriptionItem.ended",
      "subscriptionItem.past_due"
    ]
  }
}
```

Add package scripts:

```json
"billing:bootstrap": "agentstack billing bootstrap",
"billing:fixture": "agentstack billing fixture",
"billing:smoke": "agentstack billing smoke"
```

- [ ] **Step 4: Verify template parity**

```bash
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/b2b-saas packages/create-agent-stack/templates/b2b-saas packages/create-agent-stack/src/generate.test.ts
git commit -m "feat: add billing config to lean template"
```

## Task 4: Retire Old Generated Billing Plan Anchors

**Files:**
- Modify: `packages/core/src/billing-plans.ts`
- Modify: `packages/core/src/billing-plans.test.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Update tests to reject the stale generator**

Replace tests expecting `packages/domain/src/billing-plans`, root `convex/billing-plans`, and generated docs with a
single failure contract:

```ts
it("rejects old billing-plan generation because M3 billing is config-first", async () => {
  const code = await runAgentstack(
    ["add", "billing-plan", "Pro", "--entitlements", "feature.auditLog", "--seats", "10"],
    { cwd: dir, write: (line) => output.push(line) }
  );

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL billing-plan.removed");
  expect(output.join("\n")).toContain("Use agentstack.config.ts billing.entitlements and agentstack billing bootstrap.");
});
```

- [ ] **Step 2: Run failing focused tests**

```bash
pnpm vitest run packages/core/src/billing-plans.test.ts packages/cli/src/run.test.ts -t "billing-plan"
```

Expected: FAIL until the command is removed/replaced.

- [ ] **Step 3: Remove stale generation behavior**

In `packages/cli/src/run.ts`, keep the parser branch for `add billing-plan` only long enough to return:

```text
FAIL billing-plan.removed
The generated billing-plan anchor path was removed by the lean Agentstack contract.
Fix: Configure billing.entitlements in agentstack.config.ts and run agentstack billing bootstrap --env preview --confirm-live-mutation.
```

Delete or simplify `packages/core/src/billing-plans.ts` so no code path writes `packages/domain`, root `convex`, or
generated docs. Do not preserve a compatibility alias.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run packages/core/src/billing-plans.test.ts packages/cli/src/run.test.ts -t "billing-plan"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/billing-plans.ts packages/core/src/billing-plans.test.ts packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "refactor: remove stale billing plan generator"
```

## Task 5: Convex Billing Webhook Runtime

**Files:**
- Modify: `templates/b2b-saas/apps/convex/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/convex/package.json`
- Modify: `templates/b2b-saas/apps/convex/convex/schema.ts`
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/convex/convex/schema.ts`
- Create: `templates/b2b-saas/apps/convex/convex/http.ts`
- Create: `packages/create-agent-stack/templates/b2b-saas/apps/convex/convex/http.ts`
- Create: `templates/b2b-saas/apps/convex/convex/billing.ts`
- Create: `packages/create-agent-stack/templates/b2b-saas/apps/convex/convex/billing.ts`

- [ ] **Step 1: Add template source tests**

In `packages/create-agent-stack/src/generate.test.ts`, assert generated Convex files include:

```ts
expect(files).toContain("apps/convex/convex/http.ts");
expect(files).toContain("apps/convex/convex/billing.ts");
expect(schema).toContain("billingWebhookEvents");
expect(schema).toContain("billingEntitlements");
expect(schema).toContain("billingPrincipals");
```

- [ ] **Step 2: Run failing generator test**

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "billing"
```

Expected: FAIL until Convex files exist.

- [ ] **Step 3: Add Convex schema tables**

Add tables with indexes:

```ts
billingWebhookEvents: defineTable({
  provider: v.literal("clerk"),
  messageId: v.string(),
  eventType: v.string(),
  status: v.union(
    v.literal("received"),
    v.literal("processed"),
    v.literal("duplicate"),
    v.literal("ignored"),
    v.literal("failed")
  ),
  receivedAt: v.string(),
  processedAt: v.optional(v.string()),
  entitlementKey: v.optional(v.literal("feature.auditLog")),
  providerPayerType: v.optional(v.union(v.literal("user"), v.literal("organization"))),
  providerPayerId: v.optional(v.string()),
  redactedSummary: v.string()
})
  .index("by_provider_message", ["provider", "messageId"])
  .index("by_event_type", ["eventType"]),
billingEntitlements: defineTable({
  workspaceId: v.string(),
  entitlementKey: v.literal("feature.auditLog"),
  allowed: v.boolean(),
  provider: v.literal("clerk"),
  providerFeature: v.string(),
  providerPlan: v.optional(v.string()),
  providerPayerType: v.optional(v.union(v.literal("user"), v.literal("organization"))),
  providerPayerId: v.optional(v.string()),
  sourceEventMessageId: v.optional(v.string()),
  updatedAt: v.string()
}).index("by_workspace_entitlement", ["workspaceId", "entitlementKey"]),
billingPrincipals: defineTable({
  workspaceId: v.string(),
  clerkUserId: v.string(),
  clerkOrganizationId: v.optional(v.string()),
  fixture: v.boolean(),
  updatedAt: v.string()
})
  .index("by_user", ["clerkUserId"])
  .index("by_organization", ["clerkOrganizationId"])
```

- [ ] **Step 4: Add `billing.ts` functions**

Implement:

- `protectedEntitlementGate` query: requires `ctx.auth.getUserIdentity()`, maps subject to workspace, returns denied
  by default.
- `ensureFixturePrincipal` internal mutation: upserts the M3 smoke principal.
- `applyClerkBillingEvent` internal mutation: idempotently records event and grants/revokes `feature.auditLog`.
- `readM3BillingEvidence` query or internal query: returns redacted event/entitlement summary for CLI evidence checks.

- [ ] **Step 5: Add `http.ts` route**

Expose:

```ts
http.route({
  path: "/agentstack/webhooks/clerk/billing",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const verified = await ctx.runAction(internal.billing.verifyClerkBillingWebhook, {
      body,
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url
    });
    await ctx.runMutation(internal.billing.applyClerkBillingEvent, verified);
    return new Response("ok", { status: 200 });
  })
});
```

If Clerk's verification package needs Node APIs, put `verifyClerkBillingWebhook` in a `"use node"` action and pass only
serializable body/header values from the HTTP action.

- [ ] **Step 6: Verify template parity and typecheck**

```bash
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add templates/b2b-saas packages/create-agent-stack/templates/b2b-saas packages/create-agent-stack/src/generate.test.ts
git commit -m "feat: add convex billing webhook runtime"
```

## Task 6: Web Entitlement Gate

**Files:**
- Modify: `templates/b2b-saas/apps/web/src/App.tsx`
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/web/src/App.tsx`
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [ ] **Step 1: Add generator assertions for DOM markers**

Assert generated `App.tsx` contains:

```text
data-agentstack-entitlement-key
data-agentstack-entitlement-state
feature.auditLog
```

- [ ] **Step 2: Run failing test**

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "billing"
```

Expected: FAIL until the web template renders the gate.

- [ ] **Step 3: Implement gate**

Add `anyApi.billing.protectedEntitlementGate` and render inside the signed-in protected status path. The component must
show:

```tsx
<section
  data-agentstack-entitlement-key="feature.auditLog"
  data-agentstack-entitlement-state={gate.state}
  data-agentstack-entitlement-source={gate.source}
>
  <h2>Audit log</h2>
  {gate.state === "allowed" ? <p>Audit log available.</p> : <p>Audit log requires an active plan.</p>}
</section>
```

- [ ] **Step 4: Run focused checks**

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "billing"
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/b2b-saas packages/create-agent-stack/templates/b2b-saas packages/create-agent-stack/src/generate.test.ts
git commit -m "feat: render audit log entitlement gate"
```

## Task 7: Package-Owned Billing Commands

**Files:**
- Create: `packages/cli/src/m3-billing.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/cli/src/m2-live.ts` only for shared helper extraction

- [ ] **Step 1: Add CLI route tests**

Add tests for:

```text
agentstack billing bootstrap --env preview
agentstack billing fixture ensure --env preview --entitlement feature.auditLog
agentstack billing fixture grant --env preview --entitlement feature.auditLog
agentstack billing fixture replay-last --env preview --entitlement feature.auditLog
agentstack billing fixture delete --env preview --entitlement feature.auditLog
agentstack billing smoke --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
```

Expected behavior without `--confirm-live-mutation` for mutating commands:

```text
FAIL billing.<command>.confirmation-required
Provider mutation: none
Local mutation: none
```

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "M3 billing"
```

Expected: FAIL until commands exist.

- [ ] **Step 3: Implement command routing**

In `packages/cli/src/run.ts`, route:

```ts
if (command === "billing" && subcommand === "bootstrap") return m3BillingBootstrapCommand(rest, io);
if (command === "billing" && subcommand === "fixture") return m3BillingFixtureCommand(rest, io);
if (command === "billing" && subcommand === "smoke") return m3BillingSmokeCommand(rest, io);
```

- [ ] **Step 4: Implement hidden state paths**

In `packages/cli/src/m3-billing.ts`, use:

```ts
const evidenceDir = ".agentstack/evidence/M3-billing-webhook";
const billingStatePath = ".agentstack/billing-fixture.json";
const lastWebhookPath = ".agentstack/billing-last-webhook.json";
```

Do not write secrets to evidence files. If a webhook signing secret must be stored locally for provider setup, put it
in a separate ignored `.agentstack/clerk-billing-webhook.env` file and redact all logs.

- [ ] **Step 5: Implement `billing bootstrap`**

The command must:

- load and validate `agentstack.config.ts`
- require existing M2 provider resources and links
- derive the Convex site URL from the Convex deployment URL
- ensure Convex code has been deployed before registering the webhook route
- create or verify Clerk webhook endpoint if Clerk API/CLI supports it
- set `CLERK_WEBHOOK_SIGNING_SECRET` in the Convex preview deployment
- verify or report exact action required for Clerk Billing plan/feature setup
- write redacted evidence to `.agentstack/evidence/M3-billing-webhook/billing-bootstrap.txt`

- [ ] **Step 6: Implement `billing fixture`**

Actions:

- `ensure`: create/reuse smoke user and smoke organization, upsert Convex fixture principal, confirm denied state
- `grant`: perform the provider action that triggers a real Clerk Billing event, then poll Convex until allowed
- `revoke`: perform the provider action that triggers a real revoke event, then poll Convex until denied
- `replay-last`: replay via provider API/CLI if available; otherwise return an exact provider replay handoff and keep
  M3 blocked until completed
- `delete`: delete/revoke smoke fixture resources and hidden local fixture state

- [ ] **Step 7: Implement `billing smoke`**

Read the supplied DOM file and check:

```text
data-agentstack-auth-state="signed-in"
data-agentstack-protected-data-state="protected-data-loaded"
data-agentstack-entitlement-key="feature.auditLog"
data-agentstack-entitlement-state="<expected>"
```

Write `.agentstack/evidence/M3-billing-webhook/billing-smoke-<expected>.txt`.

- [ ] **Step 8: Run focused tests**

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "M3 billing"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/m3-billing.ts packages/cli/src/run.ts packages/cli/src/run.test.ts packages/cli/src/m2-live.ts
git commit -m "feat: add M3 billing commands"
```

## Task 8: Evidence Check Integration

**Files:**
- Modify: `packages/cli/src/m3-billing.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add evidence check tests**

Add `agentstack evidence check --env preview --milestone M3` test cases for missing and passing evidence.

Required markers:

```text
billing-bootstrap.txt: Result: PASS
billing-fixture-ensure.txt: Result: PASS
billing-fixture-grant.txt: Result: PASS
billing-fixture-replay-last.txt: Result: PASS
billing-smoke-denied.txt: Result: PASS
billing-smoke-allowed.txt: Result: PASS
```

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "M3 evidence"
```

Expected: FAIL until evidence check supports M3.

- [ ] **Step 3: Implement M3 evidence check**

Keep M2 evidence behavior intact for default `agentstack evidence check`. When `--milestone M3` is passed, check both
M2 baseline evidence and M3 billing evidence.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "M3 evidence|M2 evidence"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/m3-billing.ts packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "feat: verify M3 billing evidence"
```

## Task 9: Local Consumer E2E Rehearsal

**Files:**
- Modify: `tests/e2e/prototype.test.ts` if this is where consumer command-boundary e2e belongs
- Or create: `tests/e2e/m3-billing.test.ts`

- [ ] **Step 1: Add source e2e test**

The test must generate a lean app through the public bin with `--package-spec link:<repo>/packages/agentstack`, then
assert:

```text
root has no docs/scripts/skills/root convex/vercel.json
package scripts include billing commands
agentstack validate passes
agentstack billing bootstrap without --confirm-live-mutation refuses mutation safely
agentstack billing smoke can evaluate fixture DOM files
```

- [ ] **Step 2: Run focused e2e**

```bash
pnpm vitest run tests/e2e/prototype.test.ts packages/create-agent-stack/src/generate.test.ts packages/cli/src/run.test.ts -t "M3 billing|creates and operates"
```

Expected: PASS.

- [ ] **Step 3: Run framework checks**

```bash
pnpm typecheck
pnpm test
git diff --check
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e packages/create-agent-stack/src/generate.test.ts packages/cli/src/run.test.ts
git commit -m "test: cover M3 consumer billing path"
```

## Task 10: Live M3 Run

**Files:**
- Modify: `docs/provider-resource-ledger.md`
- Create: `docs/milestones/evidence/M3-billing-webhook/m3-live-preview-pass-2026-06-28.md`
- Modify: `docs/milestones/M3-billing-webhook.md`

- [ ] **Step 1: Generate fresh consumer app**

```bash
cd /tmp
agentstack create m3-live-$(date +%Y%m%d-%H%M%S) --package-spec link:<agentstack-repo>/packages/agentstack
cd m3-live-*
pnpm install
```

- [ ] **Step 2: Run provider/auth/deploy baseline**

```bash
pnpm run validate
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
cd apps/convex
../../node_modules/.bin/convex dev --once --configure new
cd ../..
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
pnpm run provider:link
pnpm run preview:deploy -- --confirm-live-mutation
pnpm run auth:user -- ensure --confirm-live-mutation
```

- [ ] **Step 3: Ledger M3 provider resources before mutation**

Append planned rows to `<agentstack-repo>/docs/provider-resource-ledger.md` for the Clerk Billing plan,
feature, webhook endpoint, smoke organization, smoke subscription fixture, and Convex webhook env. Convert planned rows
to active only after the provider command verifies exact identities.

- [ ] **Step 4: Bootstrap billing**

```bash
pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
```

Expected: PASS or exact provider-action-required blocker. If blocked by Clerk Billing dashboard-only setup, perform only
the exact action printed by the command, then rerun the same command.

- [ ] **Step 5: Prove denied state**

```bash
pnpm run billing:fixture -- ensure --env preview --entitlement feature.auditLog --confirm-live-mutation
```

Use the browser to sign in with the smoke user and save DOM to `.agentstack/m3-denied-dom.html`, then run:

```bash
pnpm run billing:smoke -- --env preview --expected denied --dom-file .agentstack/m3-denied-dom.html
```

Expected: PASS.

- [ ] **Step 6: Grant through real Clerk Billing webhook**

```bash
pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
```

Expected: a real Clerk Billing event is received by the Convex HTTP action and the command polls until Convex reports
`feature.auditLog` allowed.

- [ ] **Step 7: Prove allowed state**

Save DOM to `.agentstack/m3-allowed-dom.html`, then run:

```bash
pnpm run billing:smoke -- --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
```

Expected: PASS.

- [ ] **Step 8: Prove idempotency**

```bash
pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
```

Expected: PASS with duplicate event recorded and no duplicate entitlement effect. If Clerk replay requires dashboard
action, use the exact provider replay handoff printed by the command, then rerun the command to verify the duplicate.

- [ ] **Step 9: Check evidence and cleanup**

```bash
pnpm run evidence:check -- --env preview --milestone M3
pnpm run billing:fixture -- delete --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run auth:user -- delete --confirm-live-mutation
pnpm run evidence:check -- --env preview --milestone M3
```

Expected: evidence check remains PASS after safe cleanup.

- [ ] **Step 10: Record repo evidence**

Create `docs/milestones/evidence/M3-billing-webhook/m3-live-preview-pass-2026-06-28.md` with:

- generated app path
- final preview URL
- Convex webhook route URL with deployment name redacted if needed
- active ledger row references
- command pass/fail summary
- denied and allowed DOM marker summary
- idempotency result
- cleanup result
- friction log

- [ ] **Step 11: Run final verification**

```bash
pnpm typecheck
pnpm test
git diff --check
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS.

- [ ] **Step 12: Commit M3 validation**

```bash
git add AGENTS.md docs/milestones docs/provider-resource-ledger.md packages templates tests
git commit -m "feat: validate M3 clerk billing webhook"
```

## Self-Review

- Spec coverage: the plan covers typed config, lean template, Convex webhook, entitlement state, UI gate, package-owned
  commands, fixture lifecycle, evidence, live run, and cleanup.
- Known risk: Clerk may not expose stable API/CLI operations for plan/feature creation or subscription transitions. The
  plan handles this by making exact provider-action-required diagnostics acceptable as unblock steps, but not as M3 pass
  evidence.
- No generated app docs/scripts are introduced.
- No production billing, mobile billing, or provider matrix expansion is included.
