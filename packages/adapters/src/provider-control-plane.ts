import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentstackManifest } from "@agentstack/core";
import {
  enforceProviderLedgerResource,
  type ProviderLedgerDecision,
  type ProviderLedgerRow,
  type ProviderLedgerStatus
} from "./provider-ledger.js";

export type ProviderControlPlaneService = "clerk" | "convex" | "vercel" | "eas";
export type ProviderControlPlaneEnvironment = "preview" | "production";
export type ProviderInventoryEvidence = "local-inventory" | "ledger-local-inventory";
export type ProviderLocalLinkStatus = "linked" | "missing";
export type ProviderInventoryRowEvidence = "expected" | "ledger";
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
