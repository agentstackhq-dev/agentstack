import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentstackManifest } from "@agentstackhq/core";
import type {
  ProviderExecutionResult,
  ProviderLiveFactLabel,
  ProviderLiveIdentityConfidence
} from "./provider-executor.js";
import {
  evaluateProviderIdentityCandidateProof,
  evaluateProviderExactIdentityProof,
  type ProviderProofRequirementLabel
} from "./provider-proof-contracts.js";
import {
  enforceProviderLedgerResource,
  type ProviderLedgerDecision,
  type ProviderLedgerExpectedMatch,
  type ProviderLedgerRow,
  type ProviderLedgerStatus
} from "./provider-ledger.js";

export type ProviderControlPlaneService = "clerk" | "convex" | "vercel" | "eas";
export type ProviderControlPlaneEnvironment = "preview" | "production";
export type ProviderInventorySource = "local" | "live";
export type ProviderInventoryEvidence = "local-inventory" | "ledger-local-inventory" | "live-read-inventory";
export type ProviderLocalLinkStatus = "linked" | "missing";
export type ProviderInventoryRowEvidence = "expected" | "ledger";
export type ProviderInventoryLiveStatus = "not-checked" | "found" | "not-found" | "auth-failed" | "unknown";
export type ProviderInventoryIdentityMatch = "not-checked" | "matched" | "mismatched" | "ambiguous";
export type ProviderInventoryPermissionSummary = "not-checked" | "read-ok" | "read-failed";
export type ProviderInventoryDriftSummary = "not-checked" | "none" | "possible" | "unknown";
export type ProviderInventoryIdentityScope = ProviderLiveIdentityConfidence | "exact";
export type ProviderIdentityProofMissingLabel = ProviderProofRequirementLabel | "successful-live-read";
export type ProviderLinkLedgerStatus = Extract<ProviderLedgerStatus, "planned" | "active">;

export type ProviderLinkState = {
  links: ProviderLinkStateRow[];
};

export type ProviderLinkStateRow = {
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  resourceType: string;
  name: string;
  ledgerStatus: ProviderLinkLedgerStatus;
  linkedAt: string;
};

export type ProviderInventoryInput = {
  cwd: string;
  manifest: AgentstackManifest;
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  ledgerRows: ProviderLedgerRow[];
};

export type ProviderInventory = {
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  evidence: ProviderInventoryEvidence;
  rows: ProviderInventoryRow[];
  liveReadSummary?: ProviderInventoryLiveReadSummary;
};

export type ProviderInventoryRow = {
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  resourceType: string;
  name: string;
  evidence: ProviderInventoryRowEvidence;
  localLink: ProviderLocalLinkStatus;
  ledgerStatus: ProviderLedgerStatus | "missing";
  externalIdSummary: "none" | "redacted";
  liveStatus?: ProviderInventoryLiveStatus;
  identityMatch?: ProviderInventoryIdentityMatch;
  identityScope?: ProviderInventoryIdentityScope;
  permissionSummary?: ProviderInventoryPermissionSummary;
  driftSummary?: ProviderInventoryDriftSummary;
  facts?: ProviderLiveFactLabel[];
  missingProof?: ProviderIdentityProofMissingLabel[];
};

export type ProviderInventoryLiveReadSummary = {
  commands: number;
  results: number;
  succeeded: number;
  failed: number;
};

export type ProviderLiveConfirmation =
  | { ok: true }
  | { ok: false; reason: "live-read" | "identity-ambiguous" };

export type ProviderLifecycleAction = "create" | "provision" | "update" | "no-op" | "blocked";

export type ProviderLifecyclePlanInput = {
  manifest: AgentstackManifest;
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  ledgerRows: ProviderLedgerRow[];
  pendingOperationCount: number;
};

export type ProviderLifecyclePlan = {
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  resourceType: string;
  name: string;
  ledgerStatus: ProviderLedgerStatus | "missing" | "invalid";
  lifecycle: ProviderLifecycleAction;
  reason:
    | "ledger-missing"
    | "ledger-planned"
    | "active-with-local-operations"
    | "active-without-local-operations"
    | "ledger-blocked";
  pendingOperationCount: number;
};

export type LiveProviderInventoryInput = {
  localInventory: ProviderInventory;
  readResults: ProviderExecutionResult[];
};

export type ProviderLinkInput = {
  cwd: string;
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  resourceType: string;
  name: string;
  ledgerRows: ProviderLedgerRow[];
};

export type ProviderLinkResult =
  | {
      ok: true;
      evidence: "ledger-local-inventory";
      link: ProviderLinkStateRow;
    }
  | {
      ok: false;
      evidence: "local-inventory";
      decision: Exclude<ProviderLedgerDecision, { ok: true }>;
    };

export type ProviderAdoptProposalInput = {
  service: ProviderControlPlaneService;
  environment: ProviderControlPlaneEnvironment;
  resourceType: string;
  name: string;
  externalIdOrUrl: string;
  ownerAccountOrProject: string;
  purpose: string;
  createdBy: string;
  createdAt: string;
  expectedCleanupTriggerOrDate: string;
  cleanupCommandOrProcedure: string;
  evidenceLinkOrPath: string;
  notes: string;
};

export type ProviderAdoptProposal = {
  mode: "print-only";
  lines: string[];
};

const providerLinkStatePath = ".agentstack/provider-links.json";

export async function createProviderInventory(input: ProviderInventoryInput): Promise<ProviderInventory> {
  const expected = expectedProviderResource(input.manifest, input.service, input.environment);
  const state = await readProviderLinkStateForInventory(input.cwd);
  const link = state.links.find((candidate) => linkMatches(candidate, input.service, input.environment, expected));
  const ledgerRow = input.ledgerRows.find((candidate) =>
    ledgerMatches(candidate, input.service, input.environment, expected)
  );
  const allowedLedgerStatus =
    ledgerRow !== undefined && (ledgerRow.status === "planned" || ledgerRow.status === "active")
      ? ledgerRow.status
      : undefined;

  return {
    service: input.service,
    environment: input.environment,
    evidence: allowedLedgerStatus === undefined ? "local-inventory" : "ledger-local-inventory",
    rows: [
      {
        service: input.service,
        environment: input.environment,
        resourceType: expected.resourceType,
        name: expected.name,
        evidence: allowedLedgerStatus === undefined ? "expected" : "ledger",
        localLink: link === undefined ? "missing" : "linked",
        ledgerStatus: ledgerRow?.status ?? "missing",
        externalIdSummary: ledgerRow?.externalIdOrUrl.trim() ? "redacted" : "none"
      }
    ]
  };
}

export async function createLiveProviderInventory(input: LiveProviderInventoryInput): Promise<ProviderInventory> {
  const summary = summarizeLiveReadResults(input.readResults);
  const failed = input.readResults.some((result) => result.status === "failed");
  const authFailed = input.readResults.some((result) => result.failureClass === "auth");
  const notFound = input.readResults.some((result) => result.failureClass === "not-found");
  const liveFacts = summarizeLiveIdentityFacts(input.readResults);
  const exactIdentityDecision = evaluateProviderExactIdentityProof(input.localInventory.service, input.readResults);
  const candidateIdentityDecision = evaluateProviderIdentityCandidateProof(
    input.localInventory.service,
    input.readResults
  );
  const missingProof = summarizeMissingIdentityProof(
    input.readResults,
    exactIdentityDecision.missing,
    candidateIdentityDecision.missing
  );
  const identityScope: ProviderInventoryIdentityScope =
    exactIdentityDecision.proof === "exact" ? "exact" : liveFacts.identityScope;
  const liveStatus: ProviderInventoryLiveStatus = authFailed
    ? "auth-failed"
    : notFound
      ? "not-found"
      : failed
        ? "unknown"
        : identityScope === "none"
          ? "unknown"
          : "found";
  const permissionSummary: ProviderInventoryPermissionSummary = failed ? "read-failed" : "read-ok";

  return {
    ...input.localInventory,
    evidence: "live-read-inventory",
    liveReadSummary: summary,
    rows: input.localInventory.rows.map((row) => ({
      ...row,
      liveStatus,
      identityMatch: exactIdentityDecision.proof === "exact" ? "matched" : "ambiguous",
      identityScope,
      permissionSummary,
      driftSummary: "unknown",
      facts: liveFacts.facts.length > 0 ? liveFacts.facts : undefined,
      missingProof: missingProof.length > 0 ? missingProof : undefined
    }))
  };
}

export function confirmLiveProviderInventoryIdentity(inventory: ProviderInventory): ProviderLiveConfirmation {
  if ((inventory.liveReadSummary?.failed ?? 0) > 0) {
    return { ok: false, reason: "live-read" };
  }

  if (inventory.rows.every((row) => row.identityMatch === "matched")) {
    return { ok: true };
  }

  return { ok: false, reason: "identity-ambiguous" };
}

export function createProviderLifecyclePlan(input: ProviderLifecyclePlanInput): ProviderLifecyclePlan {
  const expected = expectedProviderResource(input.manifest, input.service, input.environment);
  const expectedMatch: ProviderLedgerExpectedMatch = {
    provider: input.service,
    environment: input.environment,
    resourceType: expected.resourceType,
    resourceName: expected.name
  };
  const decision = enforceProviderLedgerResource(input.ledgerRows, expectedMatch);

  if (decision.ok) {
    if (decision.row.status === "planned") {
      return lifecyclePlan(input, expected, "planned", "provision", "ledger-planned");
    }

    return input.pendingOperationCount > 0
      ? lifecyclePlan(input, expected, "active", "update", "active-with-local-operations")
      : lifecyclePlan(input, expected, "active", "no-op", "active-without-local-operations");
  }

  if (decision.reason === "missing") {
    return lifecyclePlan(input, expected, "missing", "create", "ledger-missing");
  }

  const ledgerStatus =
    decision.reason === "status-blocked" ? decision.row.status : "invalid";
  return lifecyclePlan(input, expected, ledgerStatus, "blocked", "ledger-blocked");
}

function lifecyclePlan(
  input: ProviderLifecyclePlanInput,
  expected: { resourceType: string; name: string },
  ledgerStatus: ProviderLifecyclePlan["ledgerStatus"],
  lifecycle: ProviderLifecycleAction,
  reason: ProviderLifecyclePlan["reason"]
): ProviderLifecyclePlan {
  return {
    service: input.service,
    environment: input.environment,
    resourceType: expected.resourceType,
    name: expected.name,
    ledgerStatus,
    lifecycle,
    reason,
    pendingOperationCount: input.pendingOperationCount
  };
}

function summarizeLiveIdentityFacts(readResults: ProviderExecutionResult[]): {
  identityScope: ProviderInventoryIdentityScope;
  facts: ProviderLiveFactLabel[];
} {
  if (readResults.some((result) => result.status === "failed")) {
    return { identityScope: "none", facts: [] };
  }

  const facts = new Set<ProviderLiveFactLabel>();
  let identityScope: ProviderInventoryIdentityScope = "none";

  for (const result of readResults) {
    if (result.status !== "success" || !result.liveIdentityFacts) {
      continue;
    }

    if (result.liveIdentityFacts.identityConfidence === "partial") {
      identityScope = "partial";
    }

    for (const fact of result.liveIdentityFacts.facts) {
      facts.add(fact);
    }
  }

  return { identityScope, facts: [...facts].sort() };
}

function summarizeMissingIdentityProof(
  readResults: ProviderExecutionResult[],
  exactMissing: ProviderProofRequirementLabel[],
  candidateMissing: ProviderProofRequirementLabel[]
): ProviderIdentityProofMissingLabel[] {
  if (readResults.some((result) => result.status === "failed")) {
    return ["successful-live-read"];
  }

  if (exactMissing.length === 0) {
    return [];
  }

  if (exactMissing.some((label) => !candidateMissing.includes(label))) {
    return candidateMissing;
  }

  return candidateMissing.length < exactMissing.length ? candidateMissing : exactMissing;
}

export async function linkLedgerBackedProviderResource(input: ProviderLinkInput): Promise<ProviderLinkResult> {
  const expectedMatch = {
    provider: input.service,
    environment: input.environment,
    resourceType: input.resourceType,
    resourceName: input.name
  };
  const decision = enforceProviderLedgerResource(input.ledgerRows, expectedMatch);
  if (!decision.ok) {
    return { ok: false, evidence: "local-inventory", decision };
  }

  const state = await readProviderLinkState(input.cwd);
  const link: ProviderLinkStateRow = {
    service: input.service,
    environment: input.environment,
    resourceType: input.resourceType,
    name: input.name,
    ledgerStatus: decision.row.status as ProviderLinkLedgerStatus,
    linkedAt: new Date().toISOString()
  };
  const links = state.links.filter(
    (candidate) => !linkMatches(candidate, input.service, input.environment, input)
  );
  links.push(link);
  await writeProviderLinkState(input.cwd, { links });

  return { ok: true, evidence: "ledger-local-inventory", link };
}

export async function readProviderLinkState(cwd: string): Promise<ProviderLinkState> {
  let text: string;
  try {
    text = await readFile(join(cwd, providerLinkStatePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { links: [] };
    }
    throw error;
  }

  const parsed = JSON.parse(text) as Partial<ProviderLinkState>;
  return {
    links: Array.isArray(parsed.links)
      ? parsed.links.filter(isProviderLinkStateRow).map((link) => ({ ...link }))
      : []
  };
}

async function readProviderLinkStateForInventory(cwd: string): Promise<ProviderLinkState> {
  try {
    return await readProviderLinkState(cwd);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { links: [] };
    }
    throw error;
  }
}

export function buildProviderAdoptProposal(input: ProviderAdoptProposalInput): ProviderAdoptProposal {
  return {
    mode: "print-only",
    lines: [
      "Provider ledger proposal",
      `provider: ${input.service}`,
      `environment: ${input.environment}`,
      `resource type: ${input.resourceType}`,
      `name: ${input.name}`,
      "external id/url: redacted",
      `owner account/project: ${input.ownerAccountOrProject}`,
      `purpose: ${input.purpose}`,
      `created by: ${input.createdBy}`,
      `created at: ${input.createdAt}`,
      `expected cleanup trigger/date: ${input.expectedCleanupTriggerOrDate}`,
      "current status: active",
      `cleanup command/procedure: ${input.cleanupCommandOrProcedure}`,
      "cleaned at:",
      `evidence link/path: ${input.evidenceLinkOrPath}`,
      `notes: ${input.notes}`,
      "mode: print-only"
    ]
  };
}

async function writeProviderLinkState(cwd: string, state: ProviderLinkState): Promise<void> {
  const path = join(cwd, providerLinkStatePath);
  await mkdir(join(cwd, ".agentstack"), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function expectedProviderResource(
  manifest: AgentstackManifest,
  service: ProviderControlPlaneService,
  environment: ProviderControlPlaneEnvironment
): { resourceType: string; name: string } {
  if (service === "convex") {
    return {
      resourceType: "deployment",
      name: environment === "production" ? "prod" : `${manifest.app.slug}-preview`
    };
  }

  if (service === "clerk") {
    return {
      resourceType: "application",
      name: `${manifest.app.slug}-${environment}`
    };
  }

  return {
    resourceType: "project",
    name: manifest.app.slug
  };
}

function linkMatches(
  link: ProviderLinkStateRow,
  service: ProviderControlPlaneService,
  environment: ProviderControlPlaneEnvironment,
  resource: { resourceType: string; name: string }
): boolean {
  return (
    link.service === service &&
    link.environment === environment &&
    link.resourceType === resource.resourceType &&
    link.name === resource.name
  );
}

function summarizeLiveReadResults(results: ProviderExecutionResult[]): ProviderInventoryLiveReadSummary {
  const failed = results.filter((result) => result.status === "failed").length;
  return {
    commands: results.length,
    results: results.length,
    succeeded: results.length - failed,
    failed
  };
}

function ledgerMatches(
  row: ProviderLedgerRow,
  service: ProviderControlPlaneService,
  environment: ProviderControlPlaneEnvironment,
  resource: { resourceType: string; name: string }
): boolean {
  return (
    row.provider.toLowerCase() === service &&
    row.environment.toLowerCase() === environment &&
    row.resourceType.toLowerCase() === resource.resourceType.toLowerCase() &&
    row.resourceName === resource.name
  );
}

function isProviderLinkStateRow(value: unknown): value is ProviderLinkStateRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as ProviderLinkStateRow;
  return (
    isKnownService(candidate.service) &&
    (candidate.environment === "preview" || candidate.environment === "production") &&
    typeof candidate.resourceType === "string" &&
    typeof candidate.name === "string" &&
    (candidate.ledgerStatus === "planned" || candidate.ledgerStatus === "active") &&
    typeof candidate.linkedAt === "string"
  );
}

function isKnownService(value: string): value is ProviderControlPlaneService {
  return value === "clerk" || value === "convex" || value === "vercel" || value === "eas";
}
