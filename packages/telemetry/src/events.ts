import { randomUUID } from "node:crypto";

export type TelemetryEnvironment = "development" | "preview" | "production";
export type TelemetrySurface =
  | "web"
  | "mobile"
  | "convex"
  | "clerk"
  | "vercel"
  | "eas"
  | "cli"
  | "control-plane";

export type WideEvent = {
  id: string;
  name: string;
  timestamp: string;
  environment: TelemetryEnvironment;
  surface: TelemetrySurface;
  journey?: string;
  traceId: string;
  correlationId: string;
  journeyId?: string;
  actorId?: string;
  orgId?: string;
  releaseId?: string;
  state: Record<string, unknown>;
};

export type WideEventInput = {
  environment: TelemetryEnvironment;
  surface: TelemetrySurface;
  journey?: string;
  traceId?: string;
  correlationId?: string;
  journeyId?: string;
  actorId?: string;
  orgId?: string;
  releaseId?: string;
  state?: Record<string, unknown>;
};

const sensitivePattern =
  /(secret|token|password|email|key|authorization|cookie|session|jwt|phone|ip)/i;

export function createWideEvent(name: string, input: WideEventInput): WideEvent {
  return {
    id: `evt_${randomUUID()}`,
    name,
    timestamp: new Date().toISOString(),
    environment: input.environment,
    surface: input.surface,
    journey: input.journey,
    traceId: input.traceId ?? `trace_${randomUUID()}`,
    correlationId: input.correlationId ?? `corr_${randomUUID()}`,
    journeyId: input.journeyId,
    actorId: input.actorId,
    orgId: input.orgId,
    releaseId: input.releaseId,
    state: input.state ?? {}
  };
}

export function redactValue(key: string, value: unknown): unknown {
  if (sensitivePattern.test(key)) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue)
      ])
    );
  }

  return value;
}

export function redactEvent(event: WideEvent): WideEvent {
  return {
    ...event,
    actorId: event.actorId ? "[redacted]" : undefined,
    orgId: event.orgId,
    state: Object.fromEntries(
      Object.entries(event.state).map(([key, value]) => [key, redactValue(key, value)])
    )
  };
}

export function eventNameMatches(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}
