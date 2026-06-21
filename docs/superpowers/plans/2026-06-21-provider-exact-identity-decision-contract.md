# Provider Exact Identity Decision Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared sanitized exact identity proof decision contract and wire it through provider proof, inventory, link, adopt, and validate-live while current real adapters remain fail-closed and readiness stays refused.

**Architecture:** Keep exact proof artifacts separate from partial `liveIdentityFacts`; partial read facts only describe bounded read evidence and must never become exact identity. Exact proof artifacts may carry only sanitized labels and decision metadata; provider-owned identifiers, provider-owned locations, account labels, captured streams, env values, ledger row identifiers, and other provider-shaped values must never be emitted or persisted. Current Clerk, Convex, Vercel, and EAS real adapters continue to produce no exact proof artifact; every exact path in this slice is test-only through sanitized `exactIdentityProof` artifacts supplied by mock/provider-result factory inputs until provider-specific identity parsers are implemented.

**Tech Stack:** TypeScript, Vitest, existing provider executor/control-plane/proof-contract APIs, existing `agentstack provider proof/inventory/link/adopt/validate --live` CLI surfaces.

---

## File Structure

- Modify `packages/adapters/src/provider-executor.ts` to define and normalize a sanitized exact identity proof artifact/result on execution results, separate from `liveIdentityFacts`.
- Modify `packages/adapters/src/provider-executor.test.ts` to prove executor normalization, fail-closed behavior on failed reads, and raw-value rejection.
- Modify `packages/adapters/src/provider-proof-contracts.ts` to add a shared exact identity proof evaluator that can return exact only from sanitized synthetic proof artifacts with required categories and parser evidence.
- Modify `packages/adapters/src/provider-proof-contracts.test.ts` for evaluator, blocker, sanitizer, and anti-overclaim coverage.
- Modify `packages/adapters/src/provider-control-plane.ts` to project exact decisions into live inventory rows and live confirmation without trusting local ledger/link/local-cloud evidence or partial facts.
- Modify `packages/adapters/src/provider-control-plane.test.ts` for inventory, link/adopt confirmation, failed-read precedence, and no raw serialization coverage.
- Modify `packages/cli/src/run.ts` to use the shared evaluator for proof, inventory confirmation, link/adopt live confirmation, and validate-live output while keeping current real adapters ambiguous.
- Modify `packages/cli/src/run.test.ts` for CLI proof/inventory/link/adopt/live validation behavior and redaction.
- Modify `docs/consumer-production-readiness-progress.md` and/or `docs/consumer-production-readiness-roadmap.md` only in the final docs task, after implementation tests pass, to record that the decision contract exists but real adapters still do not prove exact identity.
- Do not modify `docs/provider-resource-ledger.md`, `.agentstack/provider-links.json`, `.agentstack/events.jsonl`, `.agentstack/local-cloud.json`, provider resources, or any external provider state.

## Invariants

- No legacy, compatibility, shim, deprecated alias, or old/new dual path is allowed.
- Current real adapters keep exact identity unavailable; exact identity success is synthetic-test-only in this slice.
- `liveIdentityFacts` remains partial read evidence. Do not add `"exact"` to `ProviderLiveIdentityConfidence`.
- Exact proof data must be a separate artifact/result from partial `liveIdentityFacts`.
- All exact proof labels must be sanitized lowercase labels. The serialized proof/inventory/report objects and CLI output must not include provider-owned identifiers, provider-owned locations, account labels, env values, captured stream snippets, ledger row identifiers, or provider-shaped secret strings.
- Failed live reads beat exact-looking proof artifacts.
- Missing `provider-specific-identity-parser` blocks exact identity.
- Manifest match, ledger external-id match, local provider-link state, and local-cloud state are never external identity proof.
- Provider inventory live may pass read status while identity remains ambiguous with current adapters.
- Provider link/adopt live and `validate --live` remain blocked with current adapters.
- No task creates, mutates, links, adopts, deletes, or otherwise touches external provider resources.
- Synthetic exact proof is available only in tests through sanitized `exactIdentityProof` artifacts passed to mock/provider-result factory inputs. Current real adapter code must not emit `exactIdentityProof` in this slice.

## Minimum Contract Shape

Use conservative names aligned with the current provider proof style. The exact names may be adjusted only if the existing code strongly prefers a narrower variant.

```ts
export type ProviderExactIdentityProofLabel =
  | "provider-specific-identity-parser"
  | "stable-provider-identity"
  | "ledger-comparable-identity"
  | "manifest-resource-name-match"
  | "ledger-external-id-match"
  | "provider-owner-identity"
  | "provider-resource-id"
  | "provider-environment-scope"
  | "provider-project-link-proof";

export type ProviderExactIdentityProofArtifact = {
  kind: "provider-exact-identity-proof";
  evaluator: "provider-specific-identity-parser";
  labels: ProviderExactIdentityProofLabel[];
};

export type ProviderExactIdentityDecision =
  | {
      proof: "exact";
      evaluator: "provider-exact-identity";
      labels: ProviderExactIdentityProofLabel[];
      missing: [];
    }
  | {
      proof: "ambiguous" | "unavailable";
      evaluator: "unavailable" | "provider-exact-identity";
      labels: ProviderExactIdentityProofLabel[];
      missing: ProviderProofRequirementLabel[];
    };
```

The evaluator should require successful live reads, a sanitized parser artifact, all service-required categories, and no missing `provider-specific-identity-parser`. It must ignore local-only candidate sources as exact proof unless paired with parser-derived provider proof labels.

## Task 1: Executor Artifact Boundary

**Files:**
- Modify: `packages/adapters/src/provider-executor.ts`
- Modify: `packages/adapters/src/provider-executor.test.ts`

- [ ] **Step 1: Write failing executor tests**

Add tests beside the existing live identity fact tests:

```ts
it("stores sanitized exact identity proof artifacts separately from partial live facts", () => {
  const result = createProviderExecutionResult({
    service: "vercel",
    environment: "preview",
    commandKind: "env.list",
    command: { id: "vercel.env.list", args: ["exec", "vercel", "env", "ls", "preview"] },
    result: { exitCode: 0, stdout: "Project prj_raw_secret", stderr: "", durationMs: 12 },
    exactIdentityProof: {
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-environment-scope",
        "provider-project-link-proof"
      ]
    },
    liveIdentityFacts: {
      identityConfidence: "partial",
      facts: ["env-list-read", "expected-env-names", "preview-environment"]
    }
  });

  expect(result.liveIdentityFacts?.identityConfidence).toBe("partial");
  expect(result.exactIdentityProof?.labels).toContain("provider-specific-identity-parser");
  expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
});

it("drops exact identity proof artifacts from failed command results", () => {
  const result = createProviderExecutionResult({
    service: "vercel",
    environment: "preview",
    commandKind: "env.list",
    command: { id: "vercel.env.list", args: ["exec", "vercel", "env", "ls", "preview"] },
    result: { exitCode: 1, stdout: "Project prj_raw_secret", stderr: "auth failed", durationMs: 12 },
    exactIdentityProof: {
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: ["provider-specific-identity-parser", "stable-provider-identity"]
    }
  });

  expect(result.exactIdentityProof).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
});

it("drops malformed exact identity proof labels", () => {
  const result = createProviderExecutionResult({
    service: "clerk",
    environment: "preview",
    commandKind: "config.pull",
    command: { id: "clerk.config.pull", args: ["clerk", "config", "pull", "--mode", "agent"] },
    result: { exitCode: 0, stdout: "owner raw-org-name", stderr: "", durationMs: 12 },
    exactIdentityProof: {
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: [
        "provider-specific-identity-parser",
        "https://dashboard.clerk.com/raw-org",
        "RAW_PROVIDER_ID",
        "stable-provider-identity"
      ]
    } as never
  });

  expect(result.exactIdentityProof).toEqual({
    kind: "provider-exact-identity-proof",
    evaluator: "provider-specific-identity-parser",
    labels: ["provider-specific-identity-parser", "stable-provider-identity"]
  });
  expect(JSON.stringify(result)).not.toContain("raw-org-name");
  expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
  expect(JSON.stringify(result)).not.toContain("RAW_PROVIDER_ID");
});
```

- [ ] **Step 2: Run the focused failing executor tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-executor.test.ts
```

Expected: FAIL because `exactIdentityProof` is not yet accepted or normalized.

- [ ] **Step 3: Add the executor types and normalizer**

In `packages/adapters/src/provider-executor.ts`, add the exact proof artifact types near `ProviderLiveIdentityFacts`, add `exactIdentityProof?: ProviderExactIdentityProofArtifact` to `ProviderExecutionResult` and `ProviderExecutionResultInput`, and add a normalizer that only accepts the allowed labels and only persists artifacts from successful command results.

```ts
export type ProviderExactIdentityProofLabel =
  | "provider-specific-identity-parser"
  | "stable-provider-identity"
  | "ledger-comparable-identity"
  | "manifest-resource-name-match"
  | "ledger-external-id-match"
  | "provider-owner-identity"
  | "provider-resource-id"
  | "provider-environment-scope"
  | "provider-project-link-proof";

export type ProviderExactIdentityProofArtifact = {
  kind: "provider-exact-identity-proof";
  evaluator: "provider-specific-identity-parser";
  labels: ProviderExactIdentityProofLabel[];
};

const PROVIDER_EXACT_IDENTITY_PROOF_LABELS = new Set<string>([
  "provider-specific-identity-parser",
  "stable-provider-identity",
  "ledger-comparable-identity",
  "manifest-resource-name-match",
  "ledger-external-id-match",
  "provider-owner-identity",
  "provider-resource-id",
  "provider-environment-scope",
  "provider-project-link-proof"
]);

function normalizeExactIdentityProof(
  proof: ProviderExactIdentityProofArtifact | undefined
): ProviderExactIdentityProofArtifact | undefined {
  if (!proof || proof.kind !== "provider-exact-identity-proof" || proof.evaluator !== "provider-specific-identity-parser") {
    return undefined;
  }

  const labels = proof.labels.filter((label): label is ProviderExactIdentityProofLabel =>
    PROVIDER_EXACT_IDENTITY_PROOF_LABELS.has(label)
  );

  return labels.length > 0
    ? { kind: "provider-exact-identity-proof", evaluator: "provider-specific-identity-parser", labels: [...new Set(labels)].sort() }
    : undefined;
}
```

In `createProviderExecutionResult`, set:

```ts
exactIdentityProof:
  status === "success" ? normalizeExactIdentityProof(input.exactIdentityProof) : undefined,
```

Do not populate this field from current real adapter parsers.

- [ ] **Step 4: Run executor tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-executor.test.ts
```

Expected: PASS.

## Task 2: Shared Exact Identity Evaluator

**Files:**
- Modify: `packages/adapters/src/provider-proof-contracts.ts`
- Modify: `packages/adapters/src/provider-proof-contracts.test.ts`

- [ ] **Step 1: Write failing proof-contract tests**

Add tests for exact, partial, failed, and local-only evidence:

```ts
it("returns exact only for sanitized synthetic parser proof with all required labels", () => {
  const result = evaluateProviderExactIdentityProof("vercel", [
    {
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 42,
      stderrBytes: 0,
      outputRedacted: true,
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "provider-specific-identity-parser",
          "stable-provider-identity",
          "ledger-comparable-identity",
          "manifest-resource-name-match",
          "ledger-external-id-match",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-project-link-proof",
          "provider-environment-scope"
        ]
      }
    }
  ]);

  expect(result).toEqual({
    proof: "exact",
    evaluator: "provider-exact-identity",
    labels: [
      "ledger-comparable-identity",
      "ledger-external-id-match",
      "manifest-resource-name-match",
      "provider-environment-scope",
      "provider-owner-identity",
      "provider-project-link-proof",
      "provider-resource-id",
      "provider-specific-identity-parser",
      "stable-provider-identity"
    ],
    missing: []
  });
});

it("does not promote partial live facts to exact identity", () => {
  const result = evaluateProviderExactIdentityProof("vercel", [
    {
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 42,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["env-list-read", "expected-env-names", "preview-environment"]
      }
    }
  ]);

  expect(result.proof).toBe("unavailable");
  expect(result.missing).toContain("provider-specific-identity-parser");
});

it("lets failed live reads beat exact-looking artifacts", () => {
  const result = evaluateProviderExactIdentityProof("eas", [
    {
      service: "eas",
      environment: "preview",
      commandKind: "mobile.env.list",
      status: "failed",
      exitCode: 1,
      durationMs: 5,
      stdoutSummary: "",
      stderrSummary: "<redacted provider stderr: 1 line, 42 bytes>",
      stdoutLines: 0,
      stderrLines: 1,
      stdoutBytes: 0,
      stderrBytes: 42,
      outputRedacted: true,
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: ["provider-specific-identity-parser", "stable-provider-identity"]
      }
    }
  ]);

  expect(result).toEqual({
    proof: "unavailable",
    evaluator: "unavailable",
    labels: [],
    missing: ["successful-live-read"]
  });
});

it("keeps missing provider-specific parser ambiguous even with local ledger and link labels", () => {
  const result = evaluateProviderExactIdentityProof("clerk", [
    {
      service: "clerk",
      environment: "preview",
      commandKind: "local-only",
      status: "success",
      exitCode: 0,
      durationMs: 1,
      stdoutSummary: "",
      stderrSummary: "",
      stdoutLines: 0,
      stderrLines: 0,
      stdoutBytes: 0,
      stderrBytes: 0,
      outputRedacted: true,
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: ["manifest-resource-name-match", "ledger-external-id-match"]
      }
    }
  ]);

  expect(result.proof).toBe("ambiguous");
  expect(result.missing).toContain("provider-specific-identity-parser");
  expect(result.missing).toContain("stable-provider-identity");
});
```

- [ ] **Step 2: Run focused failing proof-contract tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: FAIL because `evaluateProviderExactIdentityProof` is not implemented.

- [ ] **Step 3: Implement the shared evaluator**

In `packages/adapters/src/provider-proof-contracts.ts`, import `ProviderExactIdentityProofLabel` from the executor module, define `ProviderExactIdentityDecision`, and export `evaluateProviderExactIdentityProof(service, readResults)`.

Core rules:

```ts
if (readResults.some((result) => result.status === "failed")) {
  return { proof: "unavailable", evaluator: "unavailable", labels: [], missing: ["successful-live-read"] };
}
```

Then collect labels only from successful results for the requested service and require:

```ts
const required = new Set<ProviderExactIdentityProofLabel>([
  "provider-specific-identity-parser",
  "stable-provider-identity",
  "ledger-comparable-identity",
  "manifest-resource-name-match",
  "ledger-external-id-match",
  "provider-owner-identity",
  "provider-resource-id",
  "provider-environment-scope"
]);

if (service === "vercel" || service === "eas") {
  required.add("provider-project-link-proof");
}
```

Return exact only when every required label is present. If no labels are present, return unavailable with `getProviderIdentityReadPlan(service).missingUntilParsersExist`. If labels exist but requirements are missing, return ambiguous with sanitized missing labels. Never inspect stdout/stderr summaries to infer identity.

- [ ] **Step 4: Run proof-contract tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: PASS.

## Task 3: Inventory Projection And Confirmation

**Files:**
- Modify: `packages/adapters/src/provider-control-plane.ts`
- Modify: `packages/adapters/src/provider-control-plane.test.ts`

- [ ] **Step 1: Write failing control-plane tests**

Add tests that exact decisions are projected only from exact proof artifacts and failed reads still block:

```ts
it("projects synthetic exact identity proof into live inventory without leaking captured provider output", async () => {
  const inventory = await createLiveProviderInventory({
    localInventory: await createProviderInventory({
      cwd: "/tmp/no-state",
      manifest: createDefaultManifest("acme-crm"),
      service: "vercel",
      environment: "preview",
      ledgerRows: []
    }),
    readResults: [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 12,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "<redacted provider stderr: 1 line, 33 bytes>",
        stdoutLines: 1,
        stderrLines: 1,
        stdoutBytes: 42,
        stderrBytes: 33,
        outputRedacted: true,
        exactIdentityProof: {
          kind: "provider-exact-identity-proof",
          evaluator: "provider-specific-identity-parser",
          labels: [
            "provider-specific-identity-parser",
            "stable-provider-identity",
            "ledger-comparable-identity",
            "manifest-resource-name-match",
            "ledger-external-id-match",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-project-link-proof",
            "provider-environment-scope"
          ]
        }
      }
    ]
  });

  expect(inventory.rows[0]).toMatchObject({
    liveStatus: "found",
    identityMatch: "matched",
    identityScope: "none",
    permissionSummary: "read-ok",
    missingProof: []
  });
  expect(confirmLiveProviderInventoryIdentity(inventory)).toEqual({ ok: true });
  expect(JSON.stringify(inventory)).not.toContain("prj_secret_from_mock_stdout");
  expect(JSON.stringify(inventory)).not.toContain("https://provider.example.test/team");
});

it("keeps current real-adapter partial inventory ambiguous", async () => {
  const inventory = await createLiveProviderInventory({
    localInventory: await createProviderInventory({
      cwd: "/tmp/no-state",
      manifest: createDefaultManifest("acme-crm"),
      service: "vercel",
      environment: "preview",
      ledgerRows: []
    }),
    readResults: [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 12,
        stdoutSummary: "<redacted provider stdout: 3 lines, 120 bytes>",
        stderrSummary: "",
        stdoutLines: 3,
        stderrLines: 0,
        stdoutBytes: 120,
        stderrBytes: 0,
        outputRedacted: true,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["expected-env-names", "preview-environment", "env-list-read"]
        }
      }
    ]
  });

  expect(inventory.rows[0]).toMatchObject({
    liveStatus: "found",
    identityMatch: "ambiguous",
    identityScope: "partial",
    missingProof: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  });
  expect(confirmLiveProviderInventoryIdentity(inventory)).toEqual({ ok: false, reason: "identity-ambiguous" });
});
```

- [ ] **Step 2: Run focused failing control-plane tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-control-plane.test.ts
```

Expected: FAIL because inventory does not yet evaluate exact proof artifacts.

- [ ] **Step 3: Wire evaluator into live inventory**

In `packages/adapters/src/provider-control-plane.ts`, import `evaluateProviderExactIdentityProof`. Extend:

```ts
export type ProviderInventoryIdentityMatch = "not-checked" | "matched" | "mismatched" | "ambiguous";
export type ProviderLiveConfirmation =
  | { ok: true }
  | { ok: false; reason: "live-read" | "identity-ambiguous" };
```

Inside `createLiveProviderInventory`, compute the exact decision from read results. Set `identityMatch: "matched"` and `missingProof: []` only when the exact decision is exact. Keep current `liveFacts.identityScope` unchanged so exact proof does not pretend that partial facts are exact. Keep failed live reads as `identityMatch: "ambiguous"`, `liveStatus` failure-derived, and `missingProof: ["successful-live-read"]`.

Update `confirmLiveProviderInventoryIdentity` to return ok only when every row has `identityMatch === "matched"` and there are no failed live reads.

- [ ] **Step 4: Run control-plane tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-control-plane.test.ts
```

Expected: PASS.

## Task 4: CLI Proof Output

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing CLI proof tests**

Add one synthetic exact test and one current-adapter ambiguity assertion near the provider proof tests:

```ts
it("renders synthetic exact identity proof without passing readiness", async () => {
  await writeProviderLedger([
    providerLedgerRow({
      id: "row-vercel-proof-exact",
      provider: "vercel",
      resourceType: "project",
      environment: "preview",
      name: "acme-crm",
      status: "active",
      externalId: "raw-secret-external-id",
      cleanupCommand: "delete through Vercel dashboard",
      evidence: "docs/evidence/vercel-preview.md"
    })
  ]);

  const code = await runAgentstack(
    ["provider", "proof", "--service", "vercel", "--env", "preview", "--resource-type", "project", "--name", "acme-crm"],
    {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutorWithExactIdentity("vercel")
    }
  );

  expect(code).toBe(1);
  expect(output).toContain("Identity proof: exact");
  expect(output).toContain("Exact identity candidates: available");
  expect(output).toContain("Exact identity evaluator: provider-exact-identity");
  expect(output).toContain("Readiness: refused");
  expect(output.join("\n")).not.toContain("raw-secret-external-id");
  expect(output.join("\n")).not.toContain("prj_");
  expect(output.join("\n")).not.toContain("https://");
});
```

The helper can return a normal `ProviderCommandResult`; then construct exact proof in the mock executor wrapper only for this test if the existing helper shape supports returning `ProviderExecutionResult`. If it only mocks command output, add a small test-only executor path in the CLI tests that uses the real executor-result factory with `exactIdentityProof`.

Also strengthen an existing current-adapter proof test:

```ts
expect(output).toContain("Exact identity candidates: unavailable");
expect(output).toContain("Exact identity evaluator: unavailable");
expect(output).toContain("Readiness: refused");
expect(output).not.toContain("Identity proof: exact");
```

- [ ] **Step 2: Run focused failing CLI proof tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider proof"
```

Expected: FAIL because proof report still cannot distinguish unavailable exact candidates from available synthetic exact candidates.

- [ ] **Step 3: Use the shared evaluator in `providerProofCommand`**

In `packages/cli/src/run.ts`, import `evaluateProviderExactIdentityProof`. After live results are read, compute:

```ts
const exactIdentity = liveReadFailed
  ? undefined
  : evaluateProviderExactIdentityProof(service, liveResults);
```

Extend `ProviderProofReport` so:

```ts
identityProof: "exact" | "ambiguous" | "unavailable";
identityCandidates?: "available" | "unavailable";
identityEvaluator?: "provider-exact-identity" | "unavailable";
```

For exact synthetic proof, render `Identity proof: exact`, `Exact identity candidates: available`, and `Exact identity evaluator: provider-exact-identity`, but keep `Readiness: refused` and use `Reason: drift-unproven` unless exact drift/live coherence is also proven in a later slice. For current real adapters and any successful read with no `exactIdentityProof` labels, keep `Identity proof: ambiguous`, `Exact identity candidates: unavailable`, `Exact identity evaluator: unavailable`, and `Readiness: refused`.

- [ ] **Step 4: Run focused CLI proof tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider proof"
```

Expected: PASS.

## Task 5: CLI Inventory, Link, Adopt, And Validate-Live

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing live-surface tests**

Add tests that current adapters stay blocked and synthetic exact proof only changes confirmation gates where intentionally evaluated:

```ts
it("keeps live inventory read-ok but identity ambiguous for current real adapter output", async () => {
  const code = await runAgentstack(["provider", "inventory", "--service", "vercel", "--env", "preview", "--source", "live"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("NEXT_PUBLIC_APP_URL Encrypted preview")
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("permission=read-ok");
  expect(output.join("\n")).toContain("identity=ambiguous");
  expect(output.join("\n")).toContain(
    "missing=ledger-comparable-identity,provider-environment-scope,provider-owner-identity,provider-project-link-proof,provider-resource-id,provider-specific-identity-parser,stable-provider-identity"
  );
  expect(output.join("\n")).not.toContain("identity=matched");
});

it("keeps live link and adopt blocked with current adapter output", async () => {
  // Use existing live link/adopt ambiguous setup.
  // Assert FAIL provider.link.identity-ambiguous and FAIL provider.adopt.identity-ambiguous.
  // Assert .agentstack/provider-links.json, .agentstack/events.jsonl, and .agentstack/local-cloud.json remain absent.
});

it("keeps validate-live refused with current adapter output", async () => {
  const code = await runAgentstack(["validate", "--live", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("NEXT_PUBLIC_APP_URL Encrypted preview")
  });

  expect(code).toBe(1);
  expect(output).toContain("FAIL validate --live");
  expect(output).toContain("Readiness: refused");
  expect(output.join("\n")).toContain("Reason: identity-ambiguous");
  expect(output.join("\n")).not.toContain("PASS validate --live");
  expect(output.join("\n")).not.toContain("Readiness: passed");
});
```

If adding a synthetic exact link/adopt test, keep it scoped to local confirmation semantics and assert provider mutation remains none. Do not let it create provider resources or mutate the ledger.

- [ ] **Step 2: Run focused failing live-surface tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider inventory|provider link|provider adopt|validate --live"
```

Expected: FAIL only where assertions require new exact-decision projection or helper output.

- [ ] **Step 3: Update CLI formatting and confirmation**

Use the control-plane row projection from Task 3. `formatProviderInventoryRow` should render `identity=matched` only when the inventory row is matched. It must not render exact proof labels, provider IDs, URLs, stdout/stderr, ledger row IDs, or owner/project values.

Keep these current-adapter outcomes:

```text
PASS provider inventory vercel preview
permission=read-ok
identity=ambiguous
missing=ledger-comparable-identity,provider-environment-scope,provider-owner-identity,provider-project-link-proof,provider-resource-id,provider-specific-identity-parser,stable-provider-identity

FAIL provider.link.identity-ambiguous
FAIL provider.adopt.identity-ambiguous
FAIL validate --live
Readiness: refused
Reason: identity-ambiguous
```

If synthetic exact proof makes `confirmLiveProviderInventoryIdentity` return ok, `provider link --source live` may proceed to the existing ledger-backed local link write. That path must still print `Provider mutation: none` and `Ledger mutation: none`. `provider adopt --source live` must remain print-only and must not mutate `.agentstack/provider-links.json`, telemetry, local-cloud state, provider resources, or the ledger.

`validate --live` must continue to refuse readiness even if identity confirmation becomes exact in synthetic tests, because exact drift/live coherence proof is not part of this slice.

- [ ] **Step 4: Run focused live-surface tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider inventory|provider link|provider adopt|validate --live"
```

Expected: PASS.

## Task 6: Documentation Progress Update

**Files:**
- Modify: `docs/consumer-production-readiness-progress.md` or `docs/consumer-production-readiness-roadmap.md`

- [ ] **Step 1: Update the provider proof status text**

After code tests pass, update the relevant provider proof/readiness section to say:

```md
Provider proof contracts now include a shared sanitized exact identity decision contract that can accept synthetic exact proof artifacts from future provider-specific identity parsers. Current Clerk, Convex, Vercel, and EAS real adapters still do not emit exact proof artifacts, so live inventory remains identity-ambiguous, live link/adopt remain blocked, and `validate --live` still refuses readiness with current commands.
```

Do not claim exact provider identity is available from current read commands. Do not add provider-owned identifiers, provider-owned locations, account labels, or resource names beyond existing sanitized examples.

- [ ] **Step 2: Run docs grep**

Run:

```bash
rg -n "exact identity available|Readiness: passed|provider-owned identifier|provider-owned location|captured stream" docs/consumer-production-readiness-progress.md docs/consumer-production-readiness-roadmap.md
```

Expected: no new false claim that exact identity is available from current adapters and no provider-owned identity examples.

## Task 7: Verification And Mutation Guardrails

**Files:**
- Verify only.

- [ ] **Step 1: Run focused adapter tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-executor.test.ts packages/adapters/src/provider-proof-contracts.test.ts packages/adapters/src/provider-control-plane.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused CLI tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider proof|provider inventory|provider link|provider adopt|validate --live"
```

Expected: PASS.

- [ ] **Step 3: Check provider ledger and `.agentstack` state**

Run:

```bash
git diff -- docs/provider-resource-ledger.md .agentstack/provider-links.json .agentstack/events.jsonl .agentstack/local-cloud.json
```

Expected: no diff from this implementation unless a test fixture intentionally creates files inside a temp directory outside the repo.

- [ ] **Step 4: Run plan/source hygiene checks**

Run:

```bash
rg -n "TODO|TBD|legacy|compat|shim|support older|exact identity available|Readiness: passed" docs/superpowers/plans/2026-06-21-provider-exact-identity-decision-contract.md
git diff --check
pnpm typecheck
pnpm test
```

Expected: the `rg` command may match only this plan's explicit prohibited-word guardrail lines; there must be no implementation TODOs, compatibility instructions, or readiness-pass claims. `git diff --check`, `pnpm typecheck`, and `pnpm test` must pass.

## Completion Notes For Implementer

- Stage only the files changed for this slice.
- Do not commit unless the orchestrating agent explicitly asks for a commit.
- In the final report, state that current real adapters still leave exact identity unavailable and readiness refused.
- Report any changed progress/roadmap file separately from code files.
