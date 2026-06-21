# Provider Identity Read Plan Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider identity read-plan and exact-proof contract scaffolding while provider proof, live inventory, link/adopt, and validate-live continue to refuse exact identity and readiness.

**Architecture:** Extend the existing provider proof-contract layer with sanitized provider-specific identity read-plan metadata and a provider-neutral identity proof evaluator. This historical slice originally returned only `unavailable` or `ambiguous`; the current implementation adds a narrow Clerk preview application provider-proof exact path while keeping broad exact identity, live validation readiness, and live link/adopt confirmation refused. Keep all candidate details internal and sanitized; CLI/inventory output may print only sanitized availability/evaluator labels and missing requirement labels.

**Tech Stack:** TypeScript, Vitest, existing provider executor/control-plane/proof-contract APIs, existing `agentstack provider proof` CLI output.

---

## File Structure

- Modify `packages/adapters/src/provider-proof-contracts.ts` to add identity read-plan metadata, sanitized identity candidate/evaluator types, and `evaluateProviderIdentityProof`.
- Modify `packages/adapters/src/provider-proof-contracts.test.ts` for contract, evaluator, sanitizer, and anti-overclaim tests.
- Modify `packages/adapters/src/provider-executor.test.ts` only to strengthen the existing executor-boundary test that drops unsupported runtime `identityConfidence: "exact"`; avoid changing `packages/adapters/src/provider-executor.ts` unless the new types require a compile fix.
- Modify `packages/adapters/src/provider-control-plane.test.ts` only if evaluator state is projected into inventory; prefer not to modify `packages/adapters/src/provider-control-plane.ts` in this first contract slice.
- Modify `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` only if adding output lines such as `Exact identity candidates: unavailable` or `Exact identity evaluator: unavailable`.
- Do not modify `docs/provider-resource-ledger.md`, `templates/b2b-saas/docs/provider-resource-ledger.md`, `packages/create-agent-stack/templates/b2b-saas/docs/provider-resource-ledger.md`, `.agentstack/local-cloud.json`, `.agentstack/provider-links.json`, `.agentstack/events.jsonl`, provider resources, roadmap docs, or progress docs in this slice.

## Invariants

- Do not implement matched exact identity, readiness pass, link success, adopt success, validate-live success, or provider mutations.
- Do not add `"exact"` to `ProviderLiveIdentityConfidence`; it remains `"none" | "partial"`.
- Historical slice invariant: broad `ProviderProofContract.exactIdentityAvailable` remained typed and valued as `false` here. Current code represents the narrow Clerk preview application provider-proof availability with a scoped object while keeping all other services false.
- `agentstack provider proof` must continue to exit 1 with `Identity proof: ambiguous` or `Identity proof: unavailable` and `Readiness: refused`.
- Existing live inventory/link/adopt/validate-live behavior must remain refused/ambiguous.
- Manifest resource-name match alone, ledger external-id match alone, local project link alone, and env-list facts alone are insufficient.
- Do not print raw provider IDs, URLs, owner names, ledger row IDs, env names, env values, raw stdout/stderr, or tokens.
- Requirement labels, evaluator labels, candidate-category labels, and read-plan command identifiers must be sanitized lowercase hyphen/dot strings with no provider values.

## Explorer Findings To Preserve

- Clerk current read commands are `clerk doctor --mode agent`, `clerk env pull --mode agent`, and `clerk config pull --mode agent`; they provide only partial facts today and no structured identity parser.
- Convex current read command is `convex env --deployment <preview-deployment-name> list`; the preview deployment selector is still a placeholder selector and provides only partial facts.
- Vercel current read command is `vercel env ls preview`; parser evidence is env-list rows only, with no owner/project identity.
- EAS current read command is `eas env:list --environment preview`; parser evidence is env-list rows only, with no owner/project identity.
- Future exact identity will require provider-specific stable resource identity, manifest resource-name match, ledger external-id match, owner/account/project identity, provider resource id, environment scope, and provider project/link proof where applicable.

## Task 1: Identity Read-Plan Contracts

**Files:**
- Modify: `packages/adapters/src/provider-proof-contracts.ts`
- Modify: `packages/adapters/src/provider-proof-contracts.test.ts`

- [ ] **Step 1: Write failing read-plan contract tests**

In `packages/adapters/src/provider-proof-contracts.test.ts`, extend the existing import:

```ts
import {
  evaluateProviderDriftProof,
  getProviderIdentityReadPlan,
  getProviderProofContract,
  providerProofServices,
  type ProviderProofRequirementLabel
} from "./provider-proof-contracts.js";
```

Add this test:

```ts
it("lists provider-specific sanitized identity read plans while broad exact identity remains unavailable", () => {
  expect(getProviderIdentityReadPlan("clerk")).toEqual({
    service: "clerk",
    exactIdentityAvailable: false,
    readCommands: ["clerk.doctor-agent", "clerk.env-pull-agent", "clerk.config-pull-agent"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  });

  expect(getProviderIdentityReadPlan("convex")).toEqual({
    service: "convex",
    exactIdentityAvailable: false,
    readCommands: ["convex.env-list-preview-deployment"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  });

  expect(getProviderIdentityReadPlan("vercel")).toEqual({
    service: "vercel",
    exactIdentityAvailable: false,
    readCommands: ["vercel.env-ls-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  });

  expect(getProviderIdentityReadPlan("eas")).toEqual({
    service: "eas",
    exactIdentityAvailable: false,
    readCommands: ["eas.env-list-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  });

  for (const service of providerProofServices) {
    const plan = getProviderIdentityReadPlan(service);
    expect(plan.exactIdentityAvailable).toBe(false);
    for (const label of [
      ...plan.readCommands,
      ...plan.requiredCandidateCategories,
      ...plan.missingUntilParsersExist
    ]) {
      expect(label).toMatch(/^[a-z][a-z0-9.-]*$/);
      expect(label).not.toContain("://");
      expect(label).not.toContain("_");
    }
  }
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: fail because `getProviderIdentityReadPlan` does not exist.

- [ ] **Step 2: Add minimal read-plan types and metadata**

In `packages/adapters/src/provider-proof-contracts.ts`, add:

```ts
export type ProviderIdentityReadCommandId =
  | "clerk.doctor-agent"
  | "clerk.env-pull-agent"
  | "clerk.config-pull-agent"
  | "convex.env-list-preview-deployment"
  | "vercel.env-ls-preview"
  | "eas.env-list-preview";

export type ProviderIdentityCandidateCategory =
  | "stable-provider-identity"
  | "manifest-resource-name-match"
  | "ledger-external-id-match"
  | "provider-owner-identity"
  | "provider-resource-id"
  | "provider-environment-scope"
  | "provider-project-link-proof";

export type ProviderIdentityReadPlan = {
  service: ProviderProofService;
  exactIdentityAvailable: false;
  readCommands: ProviderIdentityReadCommandId[];
  requiredCandidateCategories: ProviderIdentityCandidateCategory[];
  missingUntilParsersExist: ProviderProofRequirementLabel[];
};
```

Add:

```ts
const identityReadPlans: Record<ProviderProofService, ProviderIdentityReadPlan> = {
  clerk: {
    service: "clerk",
    exactIdentityAvailable: false,
    readCommands: ["clerk.doctor-agent", "clerk.env-pull-agent", "clerk.config-pull-agent"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  },
  convex: {
    service: "convex",
    exactIdentityAvailable: false,
    readCommands: ["convex.env-list-preview-deployment"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  },
  vercel: {
    service: "vercel",
    exactIdentityAvailable: false,
    readCommands: ["vercel.env-ls-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  },
  eas: {
    service: "eas",
    exactIdentityAvailable: false,
    readCommands: ["eas.env-list-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  }
};

export function getProviderIdentityReadPlan(service: ProviderControlPlaneService): ProviderIdentityReadPlan {
  return identityReadPlans[service];
}
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: pass.

## Task 2: Provider-Neutral Identity Proof Evaluator

**Files:**
- Modify: `packages/adapters/src/provider-proof-contracts.ts`
- Modify: `packages/adapters/src/provider-proof-contracts.test.ts`

- [ ] **Step 1: Write failing evaluator tests**

In `packages/adapters/src/provider-proof-contracts.test.ts`, extend the import:

```ts
import {
  evaluateProviderDriftProof,
  evaluateProviderIdentityProof,
  getProviderIdentityReadPlan,
  getProviderProofContract,
  providerProofServices,
  type ProviderIdentityCandidate,
  type ProviderProofRequirementLabel
} from "./provider-proof-contracts.js";
```

Add:

```ts
const completeSanitizedCandidates: ProviderIdentityCandidate[] = [
  { category: "stable-provider-identity", source: "provider-read-plan", sanitizedLabel: "stable-provider-identity" },
  { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" },
  { category: "ledger-external-id-match", source: "ledger", sanitizedLabel: "ledger-external-id-match" },
  { category: "provider-owner-identity", source: "provider-read-plan", sanitizedLabel: "provider-owner-identity" },
  { category: "provider-resource-id", source: "provider-read-plan", sanitizedLabel: "provider-resource-id" },
  { category: "provider-environment-scope", source: "provider-read-plan", sanitizedLabel: "provider-environment-scope" },
  { category: "provider-project-link-proof", source: "local-link", sanitizedLabel: "provider-project-link-proof" }
];

it("keeps identity unavailable when there are no sanitized candidates", () => {
  for (const service of providerProofServices) {
    expect(evaluateProviderIdentityProof(service, [])).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      missing: getProviderIdentityReadPlan(service).missingUntilParsersExist
    });
  }
});

it("keeps identity ambiguous even when every sanitized candidate category is present", () => {
  for (const service of providerProofServices) {
    expect(evaluateProviderIdentityProof(service, completeSanitizedCandidates)).toEqual({
      proof: "ambiguous",
      evaluator: "identity-read-plan",
      missing: ["provider-specific-identity-parser", "ledger-comparable-identity"]
    });
  }
});

it("keeps incomplete candidates ambiguous with sanitized missing labels", () => {
  expect(
    evaluateProviderIdentityProof("vercel", [
      { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" },
      { category: "ledger-external-id-match", source: "ledger", sanitizedLabel: "ledger-external-id-match" }
    ])
  ).toEqual({
    proof: "ambiguous",
    evaluator: "identity-read-plan",
    missing: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  });
});

it("drops unsanitized identity candidates before evaluation", () => {
  const result = evaluateProviderIdentityProof("clerk", [
    { category: "provider-resource-id", source: "provider-read-plan", sanitizedLabel: "app_123_raw" },
    { category: "provider-owner-identity", source: "provider-read-plan", sanitizedLabel: "https://dashboard.clerk.com/acme" },
    { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" }
  ] as never);

  expect(result).toEqual({
    proof: "ambiguous",
    evaluator: "identity-read-plan",
    missing: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  });
  expect(JSON.stringify(result)).not.toContain("app_123_raw");
  expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
});

it("ignores provider-shaped and secret-shaped labels that do not equal their category", () => {
  const result = evaluateProviderIdentityProof("vercel", [
    { category: "provider-owner-identity", source: "provider-read-plan", sanitizedLabel: "dashboard.clerk.com" },
    { category: "provider-resource-id", source: "provider-read-plan", sanitizedLabel: "prj-secret-project" },
    { category: "stable-provider-identity", source: "provider-read-plan", sanitizedLabel: "sk-live-secret" },
    { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" }
  ]);

  expect(result).toEqual({
    proof: "ambiguous",
    evaluator: "identity-read-plan",
    missing: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  });
  expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
  expect(JSON.stringify(result)).not.toContain("prj-secret-project");
  expect(JSON.stringify(result)).not.toContain("sk-live-secret");
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: fail because the evaluator and candidate types do not exist.

- [ ] **Step 2: Implement fail-closed sanitized evaluator**

In `packages/adapters/src/provider-proof-contracts.ts`, add:

```ts
export type ProviderIdentityCandidateSource = "provider-read-plan" | "manifest" | "ledger" | "local-link";

export type ProviderIdentityCandidate = {
  category: ProviderIdentityCandidateCategory;
  source: ProviderIdentityCandidateSource;
  sanitizedLabel: string;
};

export type ProviderIdentityProofResult =
  | {
      proof: "unavailable";
      evaluator: "unavailable";
      missing: ProviderProofRequirementLabel[];
    }
  | {
      proof: "ambiguous";
      evaluator: "identity-read-plan";
      missing: ProviderProofRequirementLabel[];
    };

const providerSpecificIdentityParserBlocker = "provider-specific-identity-parser" as const;
const ledgerComparableIdentityBlocker = "ledger-comparable-identity" as const;
```

Do not accept candidates by broad regex alone. The evaluator must count a candidate only when its label exactly matches its category:

```ts
candidate.sanitizedLabel === candidate.category
```

Add:

```ts
export function evaluateProviderIdentityProof(
  service: ProviderControlPlaneService,
  candidates: readonly ProviderIdentityCandidate[]
): ProviderIdentityProofResult {
  const plan = getProviderIdentityReadPlan(service);
  const sanitizedCategories = new Set(
    candidates
      .filter((candidate) => candidate.sanitizedLabel === candidate.category)
      .map((candidate) => candidate.category)
  );

  if (sanitizedCategories.size === 0) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      missing: plan.missingUntilParsersExist
    };
  }

  const missingCategories = plan.requiredCandidateCategories.filter(
    (category): category is ProviderProofRequirementLabel => !sanitizedCategories.has(category)
  );
  const missingWithoutStableIdentity = missingCategories.filter((category) => category !== "stable-provider-identity");
  const missing = [
    providerSpecificIdentityParserBlocker,
    ...(missingCategories.includes("stable-provider-identity") ? ["stable-provider-identity" as const] : []),
    ledgerComparableIdentityBlocker,
    ...missingWithoutStableIdentity
  ];
  return {
    proof: "ambiguous",
    evaluator: "identity-read-plan",
    missing
  };
}
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
pnpm typecheck
```

Expected: pass.

## Task 3: Anti-Overclaim Boundaries

**Files:**
- Modify: `packages/adapters/src/provider-proof-contracts.test.ts`
- Modify: `packages/adapters/src/provider-executor.test.ts` only if current exact-drop coverage is not strong enough
- Modify: `packages/adapters/src/provider-control-plane.test.ts` only if inventory projection changed

- [ ] **Step 1: Pin exact identity absence in proof contracts**

In `packages/adapters/src/provider-proof-contracts.test.ts`, add:

```ts
it("does not expose a broad exact identity result shape in the contract slice", () => {
  for (const service of providerProofServices) {
    const result = evaluateProviderIdentityProof(service, completeSanitizedCandidates);
    expect(result.proof).not.toBe("exact");
    expect(JSON.stringify(result)).not.toContain("\"exact\"");
    expect(getProviderProofContract(service).exactIdentityAvailable).toBe(false);
    expect(getProviderProofContract(service).liveIdentityConfidence).toBe("none");
  }
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: pass after Task 2.

- [ ] **Step 2: Strengthen executor exact-drop test if needed**

Check `packages/adapters/src/provider-executor.test.ts` for the existing test that passes runtime `identityConfidence: "exact"` as `never`. If it already asserts `result.liveIdentityFacts` is `undefined` and serialized output does not contain `exact`, leave implementation untouched. If the assertion is weaker, update that test to include:

```ts
expect(result.liveIdentityFacts).toBeUndefined();
expect(JSON.stringify(result)).not.toContain("exact");
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-executor.test.ts
```

Expected: pass.

- [ ] **Step 3: Avoid inventory projection unless required**

Do not project identity evaluator state into `packages/adapters/src/provider-control-plane.ts` in this slice. If a future edit in this task accidentally changes inventory behavior, add or keep this assertion in `packages/adapters/src/provider-control-plane.test.ts`:

```ts
expect(inventory.rows[0]).toMatchObject({
  identityMatch: "ambiguous",
  identityScope: "none"
});
expect(JSON.stringify(inventory)).not.toContain("identityScope\":\"exact");
```

Run only if the control-plane test file changed:

```bash
pnpm exec vitest run packages/adapters/src/provider-control-plane.test.ts
```

Expected: pass.

## Task 4: Optional CLI Proof Output Lines

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Decide whether output lines are needed**

Prefer no CLI output change unless the implementer needs to expose the new evaluator state. If no CLI change is made, skip the rest of Task 4 and rely on existing proof output tests.

- [ ] **Step 2: Write failing CLI output test if exposing evaluator state**

In `packages/cli/src/run.test.ts`, extend the existing provider proof test for a valid planned ledger row that refuses ambiguous identity. Add expectations:

```ts
expect(output).toContain("Exact identity candidates: unavailable");
expect(output).toContain("Exact identity evaluator: unavailable");
expect(rendered).not.toContain(rowId);
expect(rendered).not.toContain(externalId);
expect(rendered).not.toContain("raw-secret-provider-id");
expect(rendered).not.toContain("https://secret.example.test");
expect(rendered).not.toContain("LIVE_PROVIDER_ID");
expect(rendered).not.toContain("URL=");
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "runs provider proof read-only for a valid planned ledger row and refuses ambiguous identity"
```

Expected: fail only because the two new lines are absent.

- [ ] **Step 3: Print sanitized unavailable lines**

In `packages/cli/src/run.ts`, extend `ProviderProofReport` only with sanitized fields:

```ts
identityCandidates?: "unavailable";
identityEvaluator?: "unavailable";
```

In `writeProviderProofReport`, after `Identity scope`, add:

```ts
if (report.identityCandidates) {
  io.write(`Exact identity candidates: ${report.identityCandidates}`);
}
if (report.identityEvaluator) {
  io.write(`Exact identity evaluator: ${report.identityEvaluator}`);
}
```

Populate those fields only for proof-report paths where no sanitized candidate categories are evaluated yet:

```ts
identityCandidates: "unavailable",
identityEvaluator: "unavailable",
```

Do not print candidate values, provider IDs, owner names, URLs, env names, env values, stdout, stderr, ledger row IDs, or external IDs.

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "runs provider proof read-only for a valid planned ledger row and refuses ambiguous identity"
```

Expected: pass.

- [ ] **Step 4: Pin proof refusal for all provider output lines**

If Task 4 changed CLI output, update or add a table test covering Clerk, Convex, Vercel, and EAS proof paths with valid ledger rows. Assert:

```ts
expect(code).toBe(1);
expect(output).toContain(`FAIL provider proof ${service} preview`);
expect(output).toContain("Identity proof: ambiguous");
expect(output).toContain("Readiness: refused");
expect(rendered).not.toContain("raw-secret-provider-id");
expect(rendered).not.toContain("https://secret.example.test");
expect(rendered).not.toContain("owner-secret");
expect(rendered).not.toContain("row-");
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "provider proof"
```

Expected: pass.

## Task 5: Mutation Guardrails And Final Verification

**Files:**
- Test-only verification of repository state.
- No code or docs beyond the planned files above.

- [ ] **Step 1: Run focused adapter tests**

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts packages/adapters/src/provider-executor.test.ts
```

Expected: pass.

- [ ] **Step 2: Run focused CLI tests if CLI changed**

Run only if `packages/cli/src/run.ts` or `packages/cli/src/run.test.ts` changed:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "provider proof"
```

Expected: pass.

- [ ] **Step 3: Verify provider ledger docs did not change**

Run:

```bash
git diff -- docs/provider-resource-ledger.md
git diff -- templates/b2b-saas/docs/provider-resource-ledger.md
git diff -- packages/create-agent-stack/templates/b2b-saas/docs/provider-resource-ledger.md
```

Expected: no output.

- [ ] **Step 4: Verify no local state/provider-link/event files were introduced**

Run:

```bash
test ! -e .agentstack/local-cloud.json
test ! -e .agentstack/provider-links.json
test ! -e .agentstack/events.jsonl
```

Expected: all commands exit 0. If `.agentstack/` already existed before the task, inspect `git status --short .agentstack` and confirm this slice did not create or mutate those files.

- [ ] **Step 5: Run final gates**

Run:

```bash
git diff --check
pnpm typecheck
pnpm test
```

Expected: all pass.

- [ ] **Step 6: Final implementation summary**

Report the files changed, the tests run, and the refusal invariants preserved. Do not claim exact identity. Do not claim provider readiness. Do not commit unless the user explicitly asks for a commit in a later turn.

## Self-Review Checklist

- Contract metadata lists required stable fields/read commands for Clerk, Convex, Vercel, and EAS.
- Evaluator returns only `unavailable` or `ambiguous`.
- Complete sanitized candidates still do not become exact identity.
- Incomplete or unsanitized candidates do not promote identity.
- Runtime `identityConfidence: "exact"` remains dropped at executor/inventory boundaries.
- Provider proof remains nonzero with readiness refused.
- CLI output, if changed, is sanitized and does not print raw provider IDs, URLs, owner names, ledger row IDs, env names/values, stdout/stderr, or tokens.
- No local-cloud, provider-link, event, provider-resource, or provider ledger mutations are introduced.
