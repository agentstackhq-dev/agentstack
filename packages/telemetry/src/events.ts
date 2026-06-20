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
  schemaVersion?: string;
  name: string;
  timestamp: string;
  environment: TelemetryEnvironment;
  surface: TelemetrySurface;
  component?: string;
  command?: string;
  status?: string;
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
  schemaVersion?: string;
  component?: string;
  command?: string;
  status?: string;
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
const sensitiveStringPattern =
  /(^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$)|((sk|pk)_(live|test)_[A-Za-z0-9_-]+)|([A-Za-z0-9_-]*(secret|token|password|jwt|api[_-]?key)[A-Za-z0-9_-]*)/i;

export function createWideEvent(name: string, input: WideEventInput): WideEvent {
  return {
    id: `evt_${randomUUID()}`,
    schemaVersion: input.schemaVersion,
    name,
    timestamp: new Date().toISOString(),
    environment: input.environment,
    surface: input.surface,
    component: input.component,
    command: input.command,
    status: input.status,
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

  if (typeof value === "string" && sensitiveStringPattern.test(value)) {
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

export type SinceWindow = string | Date;

export type ErrorEventGroup = {
  component?: string;
  event: string;
  surface: TelemetrySurface;
  environment: TelemetryEnvironment;
  errorClass?: string;
  count: number;
};

export type EnvironmentEventCount = {
  environment: TelemetryEnvironment;
  count: number;
};

export type EnvironmentEventCountQuery = {
  environments: TelemetryEnvironment[];
  journey?: string;
  event?: string;
};

const relativeSincePattern = /^(\d+)(m|h|d)$/;

export function parseSinceWindow(since: SinceWindow, now = new Date()): Date {
  if (since instanceof Date) {
    if (Number.isNaN(since.getTime())) {
      throw new Error("Invalid since window: Date is invalid");
    }
    return since;
  }

  const relativeMatch = relativeSincePattern.exec(since);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const millisecondsByUnit = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    } as const;

    return new Date(
      now.getTime() - amount * millisecondsByUnit[unit as keyof typeof millisecondsByUnit]
    );
  }

  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid since window: ${since}`);
  }

  return parsed;
}

export function getErrorClass(event: WideEvent): string | undefined {
  const state = event.state;
  const directErrorClass = state.errorClass;
  if (typeof directErrorClass === "string") {
    return directErrorClass;
  }

  const error = state.error;
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.class === "string") {
      return errorRecord.class;
    }
    if (typeof errorRecord.name === "string") {
      return errorRecord.name;
    }
  }

  return undefined;
}

export function isErrorEvent(event: WideEvent): boolean {
  const normalizedStatus = event.status?.toLowerCase();
  return (
    normalizedStatus === "error" ||
    normalizedStatus === "failed" ||
    event.name.endsWith(".error") ||
    event.name.endsWith(".failed") ||
    getErrorClass(event) !== undefined
  );
}

export function groupErrorEvents(events: WideEvent[]): ErrorEventGroup[] {
  const groups = new Map<string, ErrorEventGroup>();

  for (const event of events) {
    if (!isErrorEvent(event)) {
      continue;
    }

    const errorClass = getErrorClass(event);
    const key = [
      event.component ?? "",
      event.name,
      event.surface,
      event.environment,
      errorClass ?? ""
    ].join("\u0000");
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    groups.set(key, {
      component: event.component,
      event: event.name,
      surface: event.surface,
      environment: event.environment,
      errorClass,
      count: 1
    });
  }

  return Array.from(groups.values()).sort(compareErrorGroups);
}

export function compareEventCountsByEnvironment(
  events: WideEvent[],
  query: EnvironmentEventCountQuery
): EnvironmentEventCount[] {
  return query.environments.map((environment) => ({
    environment,
    count: events.filter(
      (event) =>
        event.environment === environment &&
        (!query.journey || event.journey === query.journey) &&
        (!query.event || eventNameMatches(event.name, query.event))
    ).length
  }));
}

function compareErrorGroups(a: ErrorEventGroup, b: ErrorEventGroup): number {
  return (
    b.count - a.count ||
    a.environment.localeCompare(b.environment) ||
    a.surface.localeCompare(b.surface) ||
    (a.component ?? "").localeCompare(b.component ?? "") ||
    a.event.localeCompare(b.event) ||
    (a.errorClass ?? "").localeCompare(b.errorClass ?? "")
  );
}
