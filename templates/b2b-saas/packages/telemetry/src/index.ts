import type { RuntimeSurface } from "../../agentstack-runtime/src/index.js";

import type { AppTelemetryDefinition, AppTelemetryStateType } from "./events/index.js";
export * from "./events/index.js";

export type AppTelemetryEnvironment = "development" | "preview" | "production";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AppTelemetryContext = {
  appSlug: string;
  environment: AppTelemetryEnvironment;
  surface: RuntimeSurface;
  correlationId?: string;
  traceId?: string;
};

export type AppTelemetryIdentity = {
  actorId?: string;
  orgId?: string;
  journeyId?: string;
  releaseId?: string;
};

export type AppTelemetryStatus = "ok" | "error" | "pending" | "info" | "warn";

export type AppTelemetrySerializableState = Record<string, JsonValue>;

export type AppTelemetryStateValue<T extends AppTelemetryStateType> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "boolean" ? boolean :
  T extends "json" ? JsonValue :
  never;

export type AppTelemetryState<TDefinition extends AppTelemetryDefinition> = {
  [Key in keyof TDefinition["state"]]: AppTelemetryStateValue<TDefinition["state"][Key]>;
};

export type AppTelemetryEnvelope<
  TDefinition extends AppTelemetryDefinition = AppTelemetryDefinition
> = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "event";
  name: TDefinition["name"];
  journey: TDefinition["journey"];
  schemaVersion: TDefinition["schemaVersion"];
  state: AppTelemetrySerializableState;
  occurredAt: string;
};

export type AppTelemetrySpanEnvelope = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "span";
  name: string;
  spanId: string;
  parentSpanId?: string;
  status: AppTelemetryStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  state: AppTelemetrySerializableState;
};

export type AppTelemetryJourneyEnvelope = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "journey";
  journey: string;
  phase: string;
  status: AppTelemetryStatus;
  occurredAt: string;
  state: AppTelemetrySerializableState;
};

const sensitiveKeyPattern = /(secret|token|password|email|key|authorization|cookie|session|jwt|phone|ip)/i;
const sensitiveStringPattern = /(^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$)|((sk|pk)_(live|test)_[A-Za-z0-9_-]+)|([A-Za-z0-9_-]*(secret|token|password|jwt|api[_-]?key)[A-Za-z0-9_-]*)/i;

const createTelemetryId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function redactAppTelemetryValue(key: string, value: JsonValue): JsonValue {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (typeof value === "string" && sensitiveStringPattern.test(value)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactAppTelemetryValue(key, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactAppTelemetryValue(childKey, childValue)
      ])
    ) as JsonValue;
  }
  return value;
}

export function redactAppTelemetryState(state: AppTelemetrySerializableState): AppTelemetrySerializableState {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, redactAppTelemetryValue(key, value)])
  );
}

export function createAppEvent<
  TDefinition extends AppTelemetryDefinition
>(
  definition: TDefinition,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state: AppTelemetryState<TDefinition>;
    occurredAt?: string;
  }
): AppTelemetryEnvelope<TDefinition> {
  return {
    appSlug: input.appSlug,
    environment: input.environment,
    surface: input.surface,
    correlationId: input.correlationId,
    traceId: input.traceId,
    actorId: input.actorId,
    orgId: input.orgId,
    journeyId: input.journeyId,
    releaseId: input.releaseId,
    kind: "event",
    name: definition.name,
    journey: definition.journey,
    schemaVersion: definition.schemaVersion,
    state: redactAppTelemetryState(input.state),
    occurredAt: input.occurredAt ?? new Date().toISOString()
  };
}

export function createAppSpan(
  name: string,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state?: AppTelemetrySerializableState;
    spanId?: string;
    parentSpanId?: string;
    status?: AppTelemetryStatus;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
  }
): AppTelemetrySpanEnvelope {
  return {
    appSlug: input.appSlug,
    environment: input.environment,
    surface: input.surface,
    correlationId: input.correlationId,
    traceId: input.traceId,
    actorId: input.actorId,
    orgId: input.orgId,
    journeyId: input.journeyId,
    releaseId: input.releaseId,
    kind: "span",
    name,
    spanId: input.spanId ?? createTelemetryId("span"),
    parentSpanId: input.parentSpanId,
    status: input.status ?? "info",
    startedAt: input.startedAt ?? new Date().toISOString(),
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    state: redactAppTelemetryState(input.state ?? {})
  };
}

export function createAppJourney(
  journey: string,
  phase: string,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state?: AppTelemetrySerializableState;
    status?: AppTelemetryStatus;
    occurredAt?: string;
  }
): AppTelemetryJourneyEnvelope {
  return {
    appSlug: input.appSlug,
    environment: input.environment,
    surface: input.surface,
    correlationId: input.correlationId,
    traceId: input.traceId,
    actorId: input.actorId,
    orgId: input.orgId,
    journeyId: input.journeyId,
    releaseId: input.releaseId,
    kind: "journey",
    journey,
    phase,
    status: input.status ?? "info",
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    state: redactAppTelemetryState(input.state ?? {})
  };
}
