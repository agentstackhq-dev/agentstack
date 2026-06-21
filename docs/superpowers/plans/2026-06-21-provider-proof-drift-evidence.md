# Provider Proof Drift Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Surface sanitized partial drift evidence for Vercel/EAS preview env-list read results while provider proof and live validation still refuse readiness because exact live identity is unavailable.

**Architecture:** Keep identity and readiness unchanged: `ProviderLiveIdentityConfidence` remains `"none" | "partial"`, proof still exits nonzero, and `validate --live` still refuses. Add a provider-neutral drift proof evaluator in `packages/adapters` that consumes existing structured `ProviderExecutionResult.liveIdentityFacts`; Vercel/EAS can contribute partial sanitized evidence only when their current env-list parsers proved an expected env name and `preview` in the same parsed row. Clerk/Convex remain unavailable/unproven.

**Tech Stack:** TypeScript, Vitest, existing provider executor facts, existing provider proof CLI output.

---

## File Structure

- Modify `packages/adapters/src/provider-proof-contracts.ts` to add provider-neutral drift evaluator types and helpers beside the current proof contracts.
- Modify `packages/adapters/src/provider-proof-contracts.test.ts` for evaluator contract, sanitizer, and Clerk/Convex unavailable cases.
- Modify `packages/adapters/src/provider-control-plane.ts` and `packages/adapters/src/provider-control-plane.test.ts` only if the worker chooses to store drift proof on inventory rows; otherwise leave inventory unchanged and evaluate directly from live read results in the CLI.
- Modify `packages/adapters/src/vercel.test.ts` and `packages/adapters/src/eas.test.ts` to pin that partial evidence only appears from structured parser matches, not loose text.
- Modify `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` so `agentstack provider proof` prints sanitized drift evidence lines when the evaluator has evidence, while still failing readiness.
- Modify `packages/adapters/src/index.ts` only if new evaluator exports are not covered by the existing `provider-proof-contracts.js` export.
- Do not touch `docs/consumer-production-readiness-progress.md`, `docs/consumer-production-readiness-roadmap.md`, provider ledger docs, local-cloud, provider-links, telemetry, or generated templates unless CLI/docs guidance output truly changes.

## Invariants

- Do not add `"exact"` to `ProviderLiveIdentityConfidence`.
- Do not make `agentstack provider proof` pass.
- Do not make `agentstack validate --live` pass.
- Do not read `.agentstack/local-cloud.json` for proof.
- Do not mutate `.agentstack/provider-links.json`, `.agentstack/events.jsonl`, telemetry stores, provider ledger files, or provider/local files.
- Do not print raw env names, raw provider stdout/stderr, provider IDs, external IDs, ledger row IDs, URLs, or token/secret values.
- Reason may become `drift-unproven` only when drift evidence exists and identity proof is still missing; never claim readiness.

## Task 1: Provider-Neutral Drift Proof Evaluator

**Files:**
- Modify: `packages/adapters/src/provider-proof-contracts.ts`
- Modify: `packages/adapters/src/provider-proof-contracts.test.ts`
- Modify: `packages/adapters/src/index.ts` only if exports are needed

- [x] **Step 1: Write failing evaluator tests**

In `packages/adapters/src/provider-proof-contracts.test.ts`, add tests importing the new helper:

```ts
import { evaluateProviderDriftProof } from "./provider-proof-contracts.js";
```

Add:

```ts
it("returns partial sanitized drift evidence for Vercel and EAS preview env-list facts", () => {
  for (const service of ["vercel", "eas"] as const) {
    expect(
      evaluateProviderDriftProof(service, [
        {
          service,
          environment: "preview",
          commandKind: service === "vercel" ? "env.list" : "mobile.env.list",
          status: "success",
          exitCode: 0,
          durationMs: 5,
          stdoutSummary: "<redacted provider stdout: 2 lines, 120 bytes>",
          stderrSummary: "",
          stdoutLines: 2,
          stderrLines: 0,
          stdoutBytes: 120,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ])
    ).toEqual({
      proof: "partial",
      evaluator: "env-list-preview",
      evidence: ["env-list-read", "expected-env-names", "preview-environment"]
    });
  }
});
```

Add:

```ts
it("keeps drift proof unavailable when facts are incomplete or provider is unsupported", () => {
  const baseResult = {
    service: "vercel",
    environment: "preview",
    commandKind: "env.list",
    status: "success",
    exitCode: 0,
    durationMs: 5,
    stdoutSummary: "PUBLIC_API_URL https://secret.example.test",
    stderrSummary: "raw stderr",
    stdoutLines: 1,
    stderrLines: 1,
    stdoutBytes: 40,
    stderrBytes: 10,
    outputRedacted: true
  } as const;

  expect(evaluateProviderDriftProof("vercel", [baseResult])).toEqual({ proof: "unavailable" });
  expect(
    evaluateProviderDriftProof("vercel", [
      {
        ...baseResult,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["expected-env-names", "env-list-read"]
        }
      }
    ])
  ).toEqual({ proof: "unavailable" });
  expect(
    evaluateProviderDriftProof("clerk", [
      {
        ...baseResult,
        service: "clerk",
        commandKind: "env.list",
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["expected-env-names", "preview-environment", "env-list-read"]
        }
      }
    ])
  ).toEqual({ proof: "unavailable" });
  expect(evaluateProviderDriftProof("convex", [])).toEqual({ proof: "unavailable" });
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
```

Expected: fail because `evaluateProviderDriftProof` does not exist.

- [x] **Step 2: Implement minimal evaluator**

In `packages/adapters/src/provider-proof-contracts.ts`, add:

```ts
import type { ProviderExecutionResult, ProviderLiveFactLabel } from "./provider-executor.js";
```

Add these types:

```ts
export type ProviderDriftProofResult =
  | { proof: "unavailable" }
  | {
      proof: "partial";
      evaluator: "env-list-preview";
      evidence: ProviderLiveFactLabel[];
    };
```

Add:

```ts
const envListPreviewFacts = ["env-list-read", "expected-env-names", "preview-environment"] as const;

export function evaluateProviderDriftProof(
  service: ProviderControlPlaneService,
  readResults: ProviderExecutionResult[]
): ProviderDriftProofResult {
  if (service !== "vercel" && service !== "eas") {
    return { proof: "unavailable" };
  }

  const hasCompleteEnvListPreviewEvidence = readResults.some((result) => {
    if (result.service !== service || result.environment !== "preview" || result.status !== "success") {
      return false;
    }
    const facts = new Set(result.liveIdentityFacts?.facts ?? []);
    return envListPreviewFacts.every((fact) => facts.has(fact));
  });

  if (!hasCompleteEnvListPreviewEvidence) {
    return { proof: "unavailable" };
  }

  return {
    proof: "partial",
    evaluator: "env-list-preview",
    evidence: [...envListPreviewFacts].sort()
  };
}
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 2: Pin Vercel/EAS Parser Boundaries

**Files:**
- Modify: `packages/adapters/src/vercel.test.ts`
- Modify: `packages/adapters/src/eas.test.ts`
- Do not modify parser code unless a test exposes a real gap.

- [x] **Step 1: Add Vercel tests for structured-row-only evidence**

In `packages/adapters/src/vercel.test.ts`, add or extend tests around `inspectVercelPreviewReadOnly`:

```ts
it("does not infer Vercel env-list facts from loose preview env prose", async () => {
  const results = await inspectVercelPreviewReadOnly({
    environment: "preview",
    executor: {
      async execute() {
        return {
          exitCode: 0,
          stdout: "preview has NEXT_PUBLIC_APP_URL somewhere, prj_secret, https://secret.example.test",
          stderr: "",
          durationMs: 1
        };
      }
    }
  });

  expect(results[0]?.liveIdentityFacts).toBeUndefined();
  expect(results[0]?.stdoutSummary).not.toContain("NEXT_PUBLIC_APP_URL");
  expect(results[0]?.stdoutSummary).not.toContain("https://secret.example.test");
});
```

Add:

```ts
it("requires Vercel expected env name and preview environment in the same parsed row", async () => {
  const results = await inspectVercelPreviewReadOnly({
    environment: "preview",
    executor: {
      async execute() {
        return {
          exitCode: 0,
          stdout: [
            "Name Environment",
            "NEXT_PUBLIC_APP_URL production",
            "UNRELATED_FLAG preview"
          ].join("\n"),
          stderr: "",
          durationMs: 1
        };
      }
    }
  });

  expect(results[0]?.liveIdentityFacts).toBeUndefined();
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/vercel.test.ts
```

Expected: pass if the current parser already enforces structured rows; otherwise fail and fix only the parser boundary.

- [x] **Step 2: Add EAS tests for structured-row-only evidence**

In `packages/adapters/src/eas.test.ts`, add:

```ts
it("does not infer EAS env-list facts from loose preview env prose", async () => {
  const results = await inspectEasPreviewReadOnly({
    environment: "preview",
    executor: {
      async execute() {
        return {
          exitCode: 0,
          stdout: "preview has EXPO_PUBLIC_APP_URL somewhere, app-secret, https://secret.example.test",
          stderr: "",
          durationMs: 1
        };
      }
    }
  });

  expect(results[0]?.liveIdentityFacts).toBeUndefined();
  expect(results[0]?.stdoutSummary).not.toContain("EXPO_PUBLIC_APP_URL");
  expect(results[0]?.stdoutSummary).not.toContain("https://secret.example.test");
});
```

Add:

```ts
it("requires EAS expected env name and preview environment in the same parsed row", async () => {
  const results = await inspectEasPreviewReadOnly({
    environment: "preview",
    executor: {
      async execute() {
        return {
          exitCode: 0,
          stdout: [
            "Name Environment",
            "EXPO_PUBLIC_APP_URL production",
            "UNRELATED_FLAG preview"
          ].join("\n"),
          stderr: "",
          durationMs: 1
        };
      }
    }
  });

  expect(results[0]?.liveIdentityFacts).toBeUndefined();
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/eas.test.ts
```

Expected: pass if the current parser already enforces structured rows; otherwise fail and fix only the parser boundary.

## Task 3: Provider Proof CLI Output And Refusal Semantics

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing Vercel/EAS proof tests**

In `packages/cli/src/run.test.ts`, add tests near the current provider proof tests. For Vercel:

```ts
it("surfaces sanitized Vercel drift evidence while refusing provider proof readiness", async () => {
  const rowId = "row-vercel-proof-secret";
  const externalId = "https://vercel.com/team/proj_secret";
  await writeProviderLedger([
    providerLedgerRow({
      id: rowId,
      provider: "vercel",
      resourceType: "project",
      environment: "preview",
      name: "acme-crm",
      status: "active",
      externalId,
      cleanupCommand: "pnpm exec vercel remove acme-crm",
      evidence: "docs/evidence/vercel-preview.md"
    })
  ]);
  await mkdir(join(dir, ".agentstack"), { recursive: true });
  await writeFile(join(dir, ".agentstack", "local-cloud.json"), '{"secret":"SEEDED_LOCAL_CLOUD_VALUE"}\n', "utf8");
  const localCloudBefore = await readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8");
  const ledgerBefore = await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8");

  const code = await runAgentstack(
    [
      "provider",
      "proof",
      "--service",
      "vercel",
      "--env",
      "preview",
      "--resource-type",
      "project",
      "--name",
      "acme-crm"
    ],
    {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor(
        ["Name Environment Value", "NEXT_PUBLIC_APP_URL preview https://secret.example.test"].join("\n")
      )
    }
  );

  const rendered = output.join("\n");
  expect(code).toBe(1);
  expect(output).toContain("FAIL provider proof vercel preview");
  expect(output).toContain("Provider execution: read-only");
  expect(output).toContain("Identity proof: ambiguous");
  expect(output).toContain("Identity scope: partial");
  expect(output).toContain("Drift proof: partial");
  expect(output).toContain("Drift evaluator: env-list-preview");
  expect(output).toContain("Readiness: refused");
  expect(["Reason: identity-ambiguous", "Reason: drift-unproven"]).toContain(
    output.find((line) => line.startsWith("Reason: "))
  );
  expect(rendered).not.toContain("NEXT_PUBLIC_APP_URL");
  expect(rendered).not.toContain("https://secret.example.test");
  expect(rendered).not.toContain("proj_secret");
  expect(rendered).not.toContain(rowId);
  expect(rendered).not.toContain(externalId);
  expect(rendered).not.toContain("SEEDED_LOCAL_CLOUD_VALUE");
  await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")).toBe(localCloudBefore);
  expect(await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8")).toBe(ledgerBefore);
});
```

Add the equivalent EAS test using:

```ts
provider: "eas",
resourceType: "project",
name: "acme-crm",
externalId: "https://expo.dev/accounts/secret/projects/acme-crm",
stdout: ["Name Environment Value", "EXPO_PUBLIC_APP_URL preview https://secret.example.test"].join("\n")
```

Expected assertions are the same: nonzero exit, `Drift proof: partial`, `Drift evaluator: env-list-preview`, readiness refused, no raw env names/URLs/external IDs/row IDs/tokens, and no local-cloud/provider-link/telemetry/ledger mutation.

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "surfaces sanitized"
```

Expected: fail because proof output still prints `Drift proof: unproven`.

- [x] **Step 2: Wire evaluator into proof command without changing pass/fail**

In `packages/cli/src/run.ts`, import:

```ts
evaluateProviderDriftProof,
type ProviderDriftProofResult,
```

Extend `ProviderProofReport`:

```ts
driftProof?: ProviderDriftProofResult;
```

In `providerProofCommand`, keep a local `liveResults: ProviderExecutionResult[] = []` before the read. Assign it from `readLiveProviderInventory(...)`, then pass:

```ts
const driftProof = liveReadFailed ? undefined : evaluateProviderDriftProof(service, liveResults);
```

into `writeProviderProofReport`.

Keep:

```ts
return 1;
```

unchanged. Keep `identityProof` as `"ambiguous"` when live reads succeed and `"unavailable"` when they fail. Set `reason` to `"drift-unproven"` only if `driftProof?.proof === "partial"` and identity proof is still missing/ambiguous; otherwise keep the existing reasons.

- [x] **Step 3: Print only sanitized drift proof lines**

In `writeProviderProofReport`, replace the fixed line:

```ts
io.write("Drift proof: unproven");
```

with:

```ts
if (report.driftProof?.proof === "partial") {
  io.write("Drift proof: partial");
  io.write(`Drift evaluator: ${report.driftProof.evaluator}`);
} else {
  io.write("Drift proof: unproven");
}
```

Do not print `report.driftProof.evidence` unless it is formatted only from the allowed sanitized labels. Do not print env names, output summaries, provider IDs, URLs, ledger IDs, external IDs, stdout, stderr, or secret values.

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "provider proof"
```

Expected: provider proof tests pass and still exit nonzero.

## Task 4: Clerk/Convex And Live Validation Guardrails

**Files:**
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/adapters/src/provider-control-plane.test.ts` only if Task 3 moved evaluator state into inventory
- Modify: `packages/cli/src/run.ts` only if tests expose drift proof leaking into live validation

- [x] **Step 1: Add Clerk/Convex proof unavailable tests**

In `packages/cli/src/run.test.ts`, add a table test for `clerk` and `convex` with successful read output containing tempting env-list-like text:

```ts
it.each([
  { service: "clerk", resourceType: "application", name: "acme-crm-preview", externalId: "clerk_secret_app_id" },
  { service: "convex", resourceType: "deployment", name: "acme-crm-preview", externalId: "https://dashboard.convex.dev/d/secret" }
] as const)("keeps $service drift proof unavailable for env-list-looking output", async ({ service, resourceType, name, externalId }) => {
  await writeProviderLedger([
    providerLedgerRow({
      id: `row-${service}-secret`,
      provider: service,
      resourceType,
      environment: "preview",
      name,
      status: "active",
      externalId,
      cleanupCommand: "delete in provider dashboard",
      evidence: `docs/evidence/${service}-preview.md`
    })
  ]);

  const code = await runAgentstack(
    ["provider", "proof", "--service", service, "--env", "preview", "--resource-type", resourceType, "--name", name],
    {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("Name Environment\nNEXT_PUBLIC_APP_URL preview\nhttps://secret.example.test")
    }
  );

  const rendered = output.join("\n");
  expect(code).toBe(1);
  expect(output).toContain(`FAIL provider proof ${service} preview`);
  expect(output).toContain("Drift proof: unproven");
  expect(rendered).not.toContain("Drift evaluator:");
  expect(rendered).not.toContain("NEXT_PUBLIC_APP_URL");
  expect(rendered).not.toContain("https://secret.example.test");
  expect(rendered).not.toContain(externalId);
});
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "drift proof"
```

Expected: pass after Task 3.

- [x] **Step 2: Verify live validation still refuses readiness**

Add or extend a `validate --live --env preview` test with Vercel/EAS env-list rows that create partial facts. Assert:

```ts
expect(code).toBe(1);
expect(output).toContain("FAIL validate --live");
expect(output).toContain("Readiness: refused");
expect(output.join("\n")).not.toContain("PASS validate --live");
expect(output.join("\n")).not.toContain("Readiness: ready");
expect(output.join("\n")).toContain("identity=ambiguous");
expect(output.join("\n")).toContain("identity-scope=partial");
```

Do not add drift proof lines to live validation in this slice unless an existing output path already requires it. The selected slice is provider proof evidence.

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "validate --live"
```

Expected: live validation remains nonzero/refused.

## Task 5: Final Verification And Drift Checks

**Files:**
- No new production files unless prior tasks required them.

- [x] **Step 1: Run focused adapter tests**

```bash
pnpm exec vitest run packages/adapters/src/provider-proof-contracts.test.ts packages/adapters/src/provider-control-plane.test.ts packages/adapters/src/provider-executor.test.ts packages/adapters/src/vercel.test.ts packages/adapters/src/eas.test.ts
```

Expected: all pass.

- [x] **Step 2: Run focused CLI tests**

```bash
pnpm exec vitest run packages/cli/src/run.test.ts -t "provider proof"
pnpm exec vitest run packages/cli/src/run.test.ts -t "validate --live"
```

Expected: all selected tests pass and proof/live validation still return nonzero in refusal cases.

- [x] **Step 3: Confirm protected files did not drift**

```bash
git diff -- docs/provider-resource-ledger.md
```

Expected: no output.

If docs/templates were touched, also run:

```bash
diff -ru templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: no output except intentionally mirrored generated-template differences. If this command is noisy because the repo has known unrelated template differences, narrow it to the exact touched docs/scripts paths.

- [x] **Step 4: Run full repo gates**

```bash
git diff --check
pnpm typecheck
pnpm test
```

Expected: all pass.

## Handoff Notes

- The evaluator proves only this sanitized statement: a successful read-only env-list result exposed structured facts that include an expected env-name label and the preview environment label.
- This is drift evidence, not identity evidence. Do not compare against ledger external IDs, provider IDs, URLs, row IDs, or raw names in this slice.
- The final CLI state should be a useful refusal, for example:

```text
FAIL provider proof vercel preview
Evidence: live-proof-check
Provider execution: read-only
Identity proof: ambiguous
Identity scope: partial
Drift proof: partial
Drift evaluator: env-list-preview
Readiness: refused
Reason: drift-unproven
```

- If the worker cannot keep the reason change narrow, keep `Reason: identity-ambiguous`; the hard requirement is that readiness remains refused and drift evidence is sanitized.
