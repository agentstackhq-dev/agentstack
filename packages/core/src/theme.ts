import type { Diagnostic } from "./diagnostics.js";

export type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    surface: string;
    muted: string;
    accent: string;
    danger: string;
    success: string;
    focusRing: string;
  };
  typography: {
    fontFamily: string;
    fontSize: { sm: number; md: number; lg: number };
    lineHeight: { tight: number; normal: number; relaxed: number };
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number };
  shadow: { sm: string; md: string; lg: string };
  motion: { durationFast: number; durationNormal: number; easingStandard: string };
  density: { controlHeight: number; listItemHeight: number };
};

type TokenValueType = "number" | "string";

type TokenShape = {
  [key: string]: TokenValueType | TokenShape;
};

const tokenFilePath = "packages/theme/tokens.json";
const blockingGates = ["validate", "validate --cloud", "deploy"];

export const defaultThemeTokens: ThemeTokens = {
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    surface: "#f8fafc",
    muted: "#64748b",
    accent: "#2563eb",
    danger: "#dc2626",
    success: "#16a34a",
    focusRing: "#38bdf8"
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: { sm: 14, md: 16, lg: 20 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 8, lg: 12 },
  shadow: {
    sm: "0 1px 2px rgb(15 23 42 / 0.08)",
    md: "0 8px 24px rgb(15 23 42 / 0.10)",
    lg: "0 18px 40px rgb(15 23 42 / 0.14)"
  },
  motion: { durationFast: 120, durationNormal: 180, easingStandard: "cubic-bezier(0.2, 0, 0, 1)" },
  density: { controlHeight: 40, listItemHeight: 48 }
};

const requiredThemeTokenShape = shapeOf(defaultThemeTokens);

export function validateThemeTokens(tokens: unknown): Diagnostic[] {
  if (!isRecord(tokens)) {
    return [
      createThemeDiagnostic({
        code: "theme.tokens.invalid",
        path: tokenFilePath,
        message: "Theme tokens must be a JSON object."
      })
    ];
  }

  return validateTokenShape(tokens, requiredThemeTokenShape, []);
}

function validateTokenShape(tokens: Record<string, unknown>, shape: TokenShape, path: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [key, expected] of Object.entries(shape)) {
    const nextPath = [...path, key];
    const value = tokens[key];

    if (value === undefined) {
      diagnostics.push(
        createThemeDiagnostic({
          code: "theme.tokens.missing",
          path: `${tokenFilePath}:${nextPath.join(".")}`,
          message: `Required theme token is missing: ${nextPath.join(".")}.`
        })
      );
      continue;
    }

    if (typeof expected === "string") {
      if (typeof value !== expected) {
        diagnostics.push(
          createThemeDiagnostic({
            code: "theme.tokens.invalid",
            path: `${tokenFilePath}:${nextPath.join(".")}`,
            message: `Theme token ${nextPath.join(".")} must be a ${expected}.`
          })
        );
      }
      continue;
    }

    if (!isRecord(value)) {
      diagnostics.push(
        createThemeDiagnostic({
          code: "theme.tokens.invalid",
          path: `${tokenFilePath}:${nextPath.join(".")}`,
          message: `Theme token group ${nextPath.join(".")} must be an object.`
        })
      );
      continue;
    }

    diagnostics.push(...validateTokenShape(value, expected, nextPath));
  }

  return diagnostics;
}

function shapeOf(value: unknown): TokenShape {
  if (!isRecord(value)) {
    throw new Error("Theme token contract must be an object.");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isRecord(entry) ? shapeOf(entry) : readTokenValueType(entry)
    ])
  );
}

function readTokenValueType(value: unknown): TokenValueType {
  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "string") {
    return "string";
  }

  throw new Error("Theme token contract only supports string and number values.");
}

function createThemeDiagnostic(input: {
  code: "theme.tokens.invalid" | "theme.tokens.missing";
  path: string;
  message: string;
}): Diagnostic {
  return {
    severity: "fail",
    code: input.code,
    path: input.path,
    message: input.message,
    fix: "Update packages/theme/tokens.json to match the Agentstack theme token contract.",
    blocks: blockingGates
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
