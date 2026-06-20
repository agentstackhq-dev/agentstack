export type TelemetryEventSurface = "web" | "mobile" | "convex";
export type TelemetryStateType = "string" | "number" | "boolean" | "json";

export interface ParsedTelemetryEventName {
  input: string;
  slug: string;
  camel: string;
  constName: string;
}

export interface TelemetryEventPlanOptions {
  journey: string;
  surfaces: readonly string[];
  state: readonly string[];
}

export interface TelemetryStateField {
  key: string;
  type: TelemetryStateType;
}

export interface PlannedTelemetryEventFile {
  path: string;
  content: string;
}

export interface TelemetryEventPlan {
  name: ParsedTelemetryEventName;
  journey: string;
  surfaces: TelemetryEventSurface[];
  state: TelemetryStateField[];
  files: PlannedTelemetryEventFile[];
}

const supportedSurfaces = ["web", "mobile", "convex"] as const;
const supportedStateTypes = ["string", "number", "boolean", "json"] as const;

export function parseTelemetryEventName(input: string): ParsedTelemetryEventName {
  if (input.length === 0) {
    throw new Error("Telemetry event name is required.");
  }

  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(input)) {
    throw new Error(
      "Telemetry event names must be lowercase dot-separated identifiers like billing.subscription.updated."
    );
  }

  const parts = input.split(".");
  const slug = parts.join("-");
  const camel = parts.map((part, index) => (index === 0 ? part : capitalize(part))).join("");

  return {
    input,
    slug,
    camel,
    constName: `${camel}Event`
  };
}

export function planTelemetryEventFiles(
  input: string,
  options: TelemetryEventPlanOptions
): TelemetryEventPlan {
  const name = parseTelemetryEventName(input);
  const journey = validateJourney(options.journey);
  const surfaces = validateSurfaces(options.surfaces);
  const state = validateState(options.state);

  return {
    name,
    journey,
    surfaces,
    state,
    files: [
      {
        path: `packages/telemetry/src/events/${name.slug}.ts`,
        content: buildEventDefinition(name, journey, surfaces, state)
      },
      {
        path: `docs/agentstack/events/${name.slug}.md`,
        content: buildEventDocs(name, journey, surfaces, state)
      }
    ]
  };
}

function validateJourney(input: string): string {
  if (input.length === 0) {
    throw new Error("Telemetry event journey is required.");
  }

  if (!/^[a-z][a-z0-9-]*$/.test(input)) {
    throw new Error("Telemetry event journey must be a lowercase identifier like billing.");
  }

  return input;
}

function validateSurfaces(input: readonly string[]): TelemetryEventSurface[] {
  if (input.length === 0) {
    throw new Error("At least one telemetry event surface is required. Supported surfaces: web, mobile, convex.");
  }

  const surfaces: TelemetryEventSurface[] = [];
  for (const surface of input) {
    if (!isTelemetryEventSurface(surface)) {
      throw new Error(
        `Unsupported telemetry event surface "${surface}". Supported surfaces: web, mobile, convex.`
      );
    }

    if (!surfaces.includes(surface)) {
      surfaces.push(surface);
    }
  }

  return supportedSurfaces.filter((surface) => surfaces.includes(surface));
}

function validateState(input: readonly string[]): TelemetryStateField[] {
  const fields: TelemetryStateField[] = [];

  for (const field of input) {
    const [key, type, extra] = field.split(":");
    if (!key || !type || extra !== undefined) {
      throw new Error(`Telemetry state field "${field}" must use key:type format.`);
    }

    if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
      throw new Error(`Telemetry state key "${key}" must be a camelCase identifier.`);
    }

    if (!isTelemetryStateType(type)) {
      throw new Error(
        `Unsupported telemetry state type "${type}". Supported state types: string, number, boolean, json.`
      );
    }

    if (!fields.some((candidate) => candidate.key === key)) {
      fields.push({ key, type });
    }
  }

  return fields;
}

function buildEventDefinition(
  name: ParsedTelemetryEventName,
  journey: string,
  surfaces: readonly TelemetryEventSurface[],
  state: readonly TelemetryStateField[]
): string {
  return `import type { AppTelemetryDefinition } from "../events.js";

export const ${name.constName} = {
  name: "${name.input}",
  journey: "${journey}",
  surfaces: ${JSON.stringify(surfaces)},
  schemaVersion: "app.event.v1",
  state: {
${state.map((field) => `    ${field.key}: "${field.type}"`).join(",\n")}
  }
} as const satisfies AppTelemetryDefinition;
`;
}

function buildEventDocs(
  name: ParsedTelemetryEventName,
  journey: string,
  surfaces: readonly TelemetryEventSurface[],
  state: readonly TelemetryStateField[]
): string {
  const stateRows =
    state.length === 0
      ? "- none"
      : state.map((field) => `- \`${field.key}\`: ${field.type}`).join("\n");

  return `# ${name.input}

Generated telemetry event anchor for \`${name.input}\`.

## Journey

- ${journey}

## Surfaces

${surfaces.map((surface) => `- ${surface}`).join("\n")}

## State

${stateRows}
`;
}

function isTelemetryEventSurface(input: string): input is TelemetryEventSurface {
  return supportedSurfaces.includes(input as TelemetryEventSurface);
}

function isTelemetryStateType(input: string): input is TelemetryStateType {
  return supportedStateTypes.includes(input as TelemetryStateType);
}

function capitalize(input: string): string {
  return input.slice(0, 1).toUpperCase() + input.slice(1);
}
