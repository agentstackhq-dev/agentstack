import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const providerLedgerPath = "docs/provider-resource-ledger.md";

export const providerLedgerStatuses = [
  "planned",
  "active",
  "cleanup-pending",
  "cleaned",
  "abandoned-with-reason"
] as const;

export type ProviderLedgerStatus = (typeof providerLedgerStatuses)[number];

export type ProviderLedgerExpectedMatch = {
  provider: string;
  environment: string;
  resourceType: string;
  resourceName: string;
};

export type ProviderLedgerRow = ProviderLedgerExpectedMatch & {
  id: string;
  status: ProviderLedgerStatus;
  ownerAccountOrProject: string;
  purpose: string;
  createdBy: string;
  createdAt: string;
  expectedCleanupTriggerOrDate: string;
  cleanupCommandOrProcedure: string;
  evidenceLinkOrPath: string;
  externalIdOrUrl: string;
  cleanedAt: string;
  notes: string;
};

export type ProviderLedgerDecision =
  | { ok: true; path: string; row: ProviderLedgerRow }
  | { ok: false; reason: "missing"; path: string; expected: ProviderLedgerExpectedMatch }
  | { ok: false; reason: "invalid"; path: string; message: string }
  | {
      ok: false;
      reason: "incomplete";
      path: string;
      row: ProviderLedgerRow;
      missingFields: ProviderLedgerRequiredField[];
    }
  | { ok: false; reason: "status-blocked"; path: string; row: ProviderLedgerRow };

export type ProviderLedgerRequiredField =
  | "owner account/project"
  | "purpose"
  | "created by"
  | "created at"
  | "expected cleanup trigger/date"
  | "cleanup command/procedure"
  | "evidence link/path";

const validStatuses = new Set<string>(providerLedgerStatuses);
const allowedStatuses = new Set<ProviderLedgerStatus>(["planned", "active"]);

const fullLedgerColumns = [
  "id",
  "provider",
  "resource type",
  "environment",
  "owner account/project",
  "name",
  "external id/url",
  "purpose",
  "created by",
  "created at",
  "expected cleanup trigger/date",
  "current status",
  "cleanup command/procedure",
  "cleaned at",
  "evidence link/path",
  "notes"
];

export function parseProviderLedger(text: string): ProviderLedgerRow[] {
  const lines = text.split(/\r?\n/);
  const ledgerStart = lines.findIndex((line) => line.trim() === "## Ledger");
  if (ledgerStart < 0) {
    return [];
  }

  const ledgerLines: string[] = [];
  for (const line of lines.slice(ledgerStart + 1)) {
    if (line.startsWith("## ")) {
      break;
    }
    ledgerLines.push(line);
  }

  const tableLines = ledgerLines.filter((line) => line.trim().startsWith("|"));
  if (tableLines.length === 0) {
    return [];
  }

  const header = splitMarkdownRow(tableLines[0]);
  const normalizedHeader = header.map(normalizeHeader);
  const schema = ledgerSchema(normalizedHeader);
  if (schema === undefined) {
    throw invalidLedgerError(
      `provider.ledger.invalid: unsupported Ledger table header. Expected ${fullLedgerColumns.length} known columns.`
    );
  }

  const rows: ProviderLedgerRow[] = [];
  for (const line of tableLines.slice(1)) {
    const cells = splitMarkdownRow(line);
    if (isSeparatorRow(cells)) {
      continue;
    }
    if (cells.length !== schema.length) {
      throw invalidLedgerError(
        `provider.ledger.invalid: Ledger row has ${cells.length} cells; expected ${schema.length}.`
      );
    }

    const values = Object.fromEntries(schema.map((key, index) => [key, cells[index]?.trim() ?? ""]));
    const status = values["current status"] ?? "";
    if (!validStatuses.has(status)) {
      throw invalidLedgerError("provider.ledger.invalid: unknown provider ledger status.");
    }

    rows.push({
      id: values.id ?? "",
      provider: values.provider ?? "",
      environment: values.environment ?? "",
      resourceType: values["resource type"] ?? "",
      resourceName: values.name ?? "",
      status: status as ProviderLedgerStatus,
      ownerAccountOrProject: values["owner account/project"] ?? "",
      purpose: values.purpose ?? "",
      createdBy: values["created by"] ?? "",
      createdAt: values["created at"] ?? "",
      expectedCleanupTriggerOrDate: values["expected cleanup trigger/date"] ?? "",
      cleanupCommandOrProcedure: values["cleanup command/procedure"] ?? "",
      evidenceLinkOrPath: values["evidence link/path"] ?? "",
      externalIdOrUrl: values["external id/url"] ?? "",
      cleanedAt: values["cleaned at"] ?? "",
      notes: values.notes ?? ""
    });
  }

  return rows;
}

export function enforceProviderLedgerResource(
  cwd: string,
  expectedMatch: ProviderLedgerExpectedMatch
): Promise<ProviderLedgerDecision>;
export function enforceProviderLedgerResource(
  rows: ProviderLedgerRow[],
  expectedMatch: ProviderLedgerExpectedMatch
): ProviderLedgerDecision;
export function enforceProviderLedgerResource(
  input: ProviderLedgerRow[] | string,
  expectedMatch: ProviderLedgerExpectedMatch
): ProviderLedgerDecision | Promise<ProviderLedgerDecision> {
  if (typeof input === "string") {
    return enforceProviderLedgerResourceFromCwd(input, expectedMatch);
  }

  const rows = input;
  const row = rows.find((candidate) => providerLedgerMatches(candidate, expectedMatch));
  if (row === undefined) {
    return { ok: false, reason: "missing", path: providerLedgerPath, expected: expectedMatch };
  }

  if (!allowedStatuses.has(row.status)) {
    return { ok: false, reason: "status-blocked", path: providerLedgerPath, row };
  }

  const missingFields = missingRequiredFields(row);
  if (missingFields.length > 0) {
    return { ok: false, reason: "incomplete", path: providerLedgerPath, row, missingFields };
  }

  return { ok: true, path: providerLedgerPath, row };
}

export async function enforceProviderLedgerResourceFromCwd(
  cwd: string,
  expectedMatch: ProviderLedgerExpectedMatch
): Promise<ProviderLedgerDecision> {
  let text: string;
  try {
    text = await readFile(join(cwd, providerLedgerPath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason: "missing", path: providerLedgerPath, expected: expectedMatch };
    }
    throw error;
  }

  try {
    return enforceProviderLedgerResource(parseProviderLedger(text), expectedMatch);
  } catch (error) {
    return { ok: false, reason: "invalid", path: providerLedgerPath, message: (error as Error).message };
  }
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeading = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = withoutLeading.endsWith("|") ? withoutLeading.slice(0, -1) : withoutLeading;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function ledgerSchema(header: string[]): string[] | undefined {
  if (sameColumns(header, fullLedgerColumns)) {
    return fullLedgerColumns;
  }
  return undefined;
}

function sameColumns(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && expected.every((column, index) => actual[index] === column);
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function providerLedgerMatches(
  row: ProviderLedgerRow,
  expectedMatch: ProviderLedgerExpectedMatch
): boolean {
  return (
    normalizeMatch(row.provider) === normalizeMatch(expectedMatch.provider) &&
    normalizeMatch(row.environment) === normalizeMatch(expectedMatch.environment) &&
    normalizeMatch(row.resourceType) === normalizeMatch(expectedMatch.resourceType) &&
    row.resourceName === expectedMatch.resourceName
  );
}

function normalizeMatch(value: string): string {
  return value.trim().toLowerCase();
}

function missingRequiredFields(row: ProviderLedgerRow): ProviderLedgerRequiredField[] {
  return [
    ["owner account/project", row.ownerAccountOrProject],
    ["purpose", row.purpose],
    ["created by", row.createdBy],
    ["created at", row.createdAt],
    ["expected cleanup trigger/date", row.expectedCleanupTriggerOrDate],
    ["cleanup command/procedure", row.cleanupCommandOrProcedure],
    ["evidence link/path", row.evidenceLinkOrPath]
  ]
    .filter(([, value]) => isBlankRequiredValue(value as string))
    .map(([field]) => field as ProviderLedgerRequiredField);
}

function isBlankRequiredValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "pending";
}

function invalidLedgerError(message: string): Error {
  const error = new Error(message);
  error.name = "ProviderLedgerInvalidError";
  return error;
}
