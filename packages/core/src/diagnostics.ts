export type DiagnosticSeverity = "info" | "warn" | "fail";

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  fix?: string;
  blocks?: string[];
  path?: string;
};

export type Result<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export function pass<T>(value: T, diagnostics: Diagnostic[] = []): Result<T> {
  return { ok: true, value, diagnostics };
}

export function fail(diagnostics: Diagnostic[]): Result<never> {
  return { ok: false, diagnostics };
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [
    `${diagnostic.severity.toUpperCase()} ${diagnostic.code}`,
    diagnostic.path ? `Path: ${diagnostic.path}` : undefined,
    diagnostic.message,
    diagnostic.fix ? `Fix: ${diagnostic.fix}` : undefined,
    diagnostic.blocks?.length ? `Blocks: ${diagnostic.blocks.join(", ")}` : undefined
  ].filter(Boolean);

  return lines.join("\n");
}
