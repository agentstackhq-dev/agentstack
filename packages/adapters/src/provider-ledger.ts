import { readFile, writeFile } from "node:fs/promises";
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

export type ProviderLedgerRecordInput = Omit<ProviderLedgerRow, "id" | "cleanedAt"> & {
  id?: string;
  cleanedAt?: string;
  replace?: boolean;
};

export type ProviderLedgerRecordResult = {
  path: string;
  row: ProviderLedgerRow;
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

export async function recordProviderLedgerResource(
  cwd: string,
  input: ProviderLedgerRecordInput
): Promise<ProviderLedgerRecordResult> {
  const path = join(cwd, providerLedgerPath);
  const text = await readFile(path, "utf8");
  const existingRows = parseProviderLedger(text);
  const row = normalizeProviderLedgerRecord(input);
  const replace = input.replace === true;

  if (existingRows.some((candidate) => providerLedgerMatches(candidate, row))) {
    if (!replace) {
      throw invalidLedgerError(
        `provider.ledger.duplicate: Ledger already has a row for ${row.provider} ${row.environment} ${row.resourceType} ${row.resourceName}.`
      );
    }

    const updatedText = replaceProviderLedgerRow(text, row);
    await writeFile(path, updatedText);
    return { path: providerLedgerPath, row };
  }

  const updatedText = appendProviderLedgerRow(text, row);
  await writeFile(path, updatedText);

  return { path: providerLedgerPath, row };
}

function normalizeProviderLedgerRecord(input: ProviderLedgerRecordInput): ProviderLedgerRow {
  const row: ProviderLedgerRow = {
    id: input.id ?? defaultLedgerRowId(input.provider, input.environment, input.resourceType),
    provider: input.provider,
    environment: input.environment,
    resourceType: input.resourceType,
    resourceName: input.resourceName,
    status: input.status,
    ownerAccountOrProject: input.ownerAccountOrProject,
    purpose: input.purpose,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    expectedCleanupTriggerOrDate: input.expectedCleanupTriggerOrDate,
    cleanupCommandOrProcedure: input.cleanupCommandOrProcedure,
    evidenceLinkOrPath: input.evidenceLinkOrPath,
    externalIdOrUrl: input.externalIdOrUrl,
    cleanedAt: input.cleanedAt ?? "",
    notes: input.notes
  };

  const cells = providerLedgerRowCells(row);
  const invalidCell = cells.find((cell) => /[\r\n|]/.test(cell));
  if (invalidCell !== undefined) {
    throw invalidLedgerError("provider.ledger.invalid: ledger cell values cannot contain pipes or newlines.");
  }

  return row;
}

function appendProviderLedgerRow(text: string, row: ProviderLedgerRow): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "No real provider resources have been recorded yet.");
  const ledgerStart = lines.findIndex((line) => line.trim() === "## Ledger");
  if (ledgerStart < 0) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger section.");
  }

  const headerIndex = lines.findIndex(
    (line, index) => index > ledgerStart && sameColumns(splitMarkdownRow(line).map(normalizeHeader), fullLedgerColumns)
  );
  if (headerIndex < 0) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger table header.");
  }

  const separatorIndex = headerIndex + 1;
  if (!isSeparatorRow(splitMarkdownRow(lines[separatorIndex] ?? ""))) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger table separator.");
  }

  let insertIndex = separatorIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex]?.trim().startsWith("|")) {
    insertIndex += 1;
  }

  lines.splice(insertIndex, 0, formatProviderLedgerRow(row));
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

function replaceProviderLedgerRow(text: string, row: ProviderLedgerRow): string {
  const lines = text.split(/\r?\n/);
  const ledgerStart = lines.findIndex((line) => line.trim() === "## Ledger");
  if (ledgerStart < 0) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger section.");
  }

  const headerIndex = lines.findIndex(
    (line, index) => index > ledgerStart && sameColumns(splitMarkdownRow(line).map(normalizeHeader), fullLedgerColumns)
  );
  if (headerIndex < 0) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger table header.");
  }

  const separatorIndex = headerIndex + 1;
  if (!isSeparatorRow(splitMarkdownRow(lines[separatorIndex] ?? ""))) {
    throw invalidLedgerError("provider.ledger.invalid: missing Ledger table separator.");
  }

  let rowIndex = separatorIndex + 1;
  while (rowIndex < lines.length && lines[rowIndex]?.trim().startsWith("|")) {
    const cells = splitMarkdownRow(lines[rowIndex] ?? "");
    if (cells.length === fullLedgerColumns.length && providerLedgerCellsMatch(cells, row)) {
      lines[rowIndex] = formatProviderLedgerRow(row);
      return `${lines.join("\n").replace(/\n*$/, "")}\n`;
    }
    rowIndex += 1;
  }

  throw invalidLedgerError(
    `provider.ledger.missing: Ledger row for ${row.provider} ${row.environment} ${row.resourceType} ${row.resourceName} was not found for replacement.`
  );
}

function formatProviderLedgerRow(row: ProviderLedgerRow): string {
  return `| ${providerLedgerRowCells(row).join(" | ")} |`;
}

function providerLedgerRowCells(row: ProviderLedgerRow): string[] {
  return [
    row.id,
    row.provider,
    row.resourceType,
    row.environment,
    row.ownerAccountOrProject,
    row.resourceName,
    row.externalIdOrUrl,
    row.purpose,
    row.createdBy,
    row.createdAt,
    row.expectedCleanupTriggerOrDate,
    row.status,
    row.cleanupCommandOrProcedure,
    row.cleanedAt,
    row.evidenceLinkOrPath,
    row.notes
  ].map((cell) => cell.trim());
}

function defaultLedgerRowId(provider: string, environment: string, resourceType: string): string {
  return `${normalizeMatch(provider)}-${normalizeMatch(environment)}-${normalizeMatch(resourceType)}`;
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

function providerLedgerCellsMatch(cells: string[], expectedMatch: ProviderLedgerExpectedMatch): boolean {
  return (
    normalizeMatch(cells[1] ?? "") === normalizeMatch(expectedMatch.provider) &&
    normalizeMatch(cells[3] ?? "") === normalizeMatch(expectedMatch.environment) &&
    normalizeMatch(cells[2] ?? "") === normalizeMatch(expectedMatch.resourceType) &&
    (cells[5] ?? "") === expectedMatch.resourceName
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
