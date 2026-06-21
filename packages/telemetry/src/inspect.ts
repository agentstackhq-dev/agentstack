import {
  groupErrorEvents,
  isErrorEvent,
  redactEvent,
  type TelemetryEnvironment,
  type WideEvent
} from "./events.js";

export type TelemetryInspectionOptions = {
  includeState?: boolean;
  clusterThreshold?: number;
};

export type TelemetryRisk = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  eventName?: string;
  timestamp?: string;
};

export type TelemetryInspectionSummary = {
  eventCount: number;
  errorCount: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  environments: TelemetryEnvironment[];
  surfaces: string[];
  journeys: string[];
  components: string[];
  releases: string[];
};

export type TelemetryTimelineEntry = {
  timestamp: string;
  environment: TelemetryEnvironment;
  surface: string;
  name: string;
  component?: string;
  traceId?: string;
  correlationId?: string;
  journeyId?: string;
  releaseId?: string;
  status?: string;
  isError: boolean;
  state?: Record<string, unknown>;
};

export type TelemetryInspectionPivots = {
  traceIds: string[];
  correlationIds: string[];
  journeyIds: string[];
  components: string[];
  releases: string[];
};

export type TelemetryEnvironmentComparison = {
  environment: TelemetryEnvironment;
  eventCount: number;
  errorCount: number;
  eventDelta: number;
  errorDelta: number;
};

export type TelemetryInspection = {
  summary: TelemetryInspectionSummary;
  timeline: TelemetryTimelineEntry[];
  pivots: TelemetryInspectionPivots;
  risks: TelemetryRisk[];
  nextQueries: string[];
  compare?: TelemetryEnvironmentComparison[];
};

export type TelemetryCompareInspectionOptions = TelemetryInspectionOptions & {
  journeyId?: string;
};

const defaultOptions = {
  includeState: true,
  clusterThreshold: 2
} as const;

export function buildTelemetryTimelineInspection(
  events: WideEvent[],
  options: TelemetryInspectionOptions = {}
): TelemetryInspection {
  return buildInspection(events, options);
}

export function buildTelemetryJourneyInspection(
  events: WideEvent[],
  journeyId: string,
  options: TelemetryInspectionOptions = {}
): TelemetryInspection {
  return buildInspection(
    events.filter((event) => event.journeyId === journeyId),
    options
  );
}

export function buildTelemetryErrorInspection(
  events: WideEvent[],
  options: TelemetryInspectionOptions = {}
): TelemetryInspection {
  return buildInspection(events.filter(isErrorEvent), options);
}

export function buildTelemetryCompareInspection(
  events: WideEvent[],
  environments: TelemetryEnvironment[],
  options: TelemetryCompareInspectionOptions = {}
): TelemetryInspection {
  const scopedEvents = options.journeyId
    ? events.filter((event) => event.journeyId === options.journeyId)
    : events;
  const inspection = buildInspection(scopedEvents, options);
  const baseline = environments[0];
  const baselineEvents = baseline
    ? scopedEvents.filter((event) => event.environment === baseline)
    : [];
  const baselineEventCount = baselineEvents.length;
  const baselineErrorCount = baselineEvents.filter(isErrorEvent).length;

  return {
    ...inspection,
    compare: environments.map((environment) => {
      const environmentEvents = scopedEvents.filter((event) => event.environment === environment);
      const eventCount = environmentEvents.length;
      const errorCount = environmentEvents.filter(isErrorEvent).length;

      return {
        environment,
        eventCount,
        errorCount,
        eventDelta: eventCount - baselineEventCount,
        errorDelta: errorCount - baselineErrorCount
      };
    })
  };
}

function buildInspection(
  events: WideEvent[],
  options: TelemetryInspectionOptions = {}
): TelemetryInspection {
  const resolvedOptions = { ...defaultOptions, ...options };
  const sortedEvents = [...events].sort(compareEvents);
  const timeline = sortedEvents.map((event) => toTimelineEntry(event, resolvedOptions.includeState));
  const risks = buildRisks(sortedEvents, resolvedOptions.clusterThreshold);
  const pivots = buildPivots(sortedEvents);

  return {
    summary: buildSummary(sortedEvents),
    timeline,
    pivots,
    risks,
    nextQueries: buildNextQueries(sortedEvents, pivots)
  };
}

function buildSummary(events: WideEvent[]): TelemetryInspectionSummary {
  return {
    eventCount: events.length,
    errorCount: events.filter(isErrorEvent).length,
    firstTimestamp: events[0]?.timestamp,
    lastTimestamp: events.at(-1)?.timestamp,
    environments: uniqueSorted(events.map((event) => event.environment)),
    surfaces: uniqueSorted(events.map((event) => event.surface)),
    journeys: uniqueSorted(events.map((event) => event.journeyId).filter(isPresent)),
    components: uniqueSorted(events.map((event) => event.component).filter(isPresent)),
    releases: uniqueSorted(events.map((event) => event.releaseId).filter(isPresent))
  };
}

function buildPivots(events: WideEvent[]): TelemetryInspectionPivots {
  return {
    traceIds: uniqueSorted(events.map((event) => event.traceId).filter(isPresent)),
    correlationIds: uniqueSorted(events.map((event) => event.correlationId).filter(isPresent)),
    journeyIds: uniqueSorted(events.map((event) => event.journeyId).filter(isPresent)),
    components: uniqueSorted(events.map((event) => event.component).filter(isPresent)),
    releases: uniqueSorted(events.map((event) => event.releaseId).filter(isPresent))
  };
}

function toTimelineEntry(event: WideEvent, includeState: boolean): TelemetryTimelineEntry {
  const redacted = redactEvent(event);
  const entry: TelemetryTimelineEntry = {
    timestamp: redacted.timestamp,
    environment: redacted.environment,
    surface: redacted.surface,
    name: redacted.name,
    component: redacted.component,
    traceId: redacted.traceId || undefined,
    correlationId: redacted.correlationId || undefined,
    journeyId: redacted.journeyId,
    releaseId: redacted.releaseId,
    status: redacted.status,
    isError: isErrorEvent(event)
  };

  if (includeState) {
    entry.state = redacted.state;
  }

  return entry;
}

function buildRisks(events: WideEvent[], clusterThreshold: number): TelemetryRisk[] {
  const risks: TelemetryRisk[] = [];

  for (const event of events) {
    if (!event.traceId) {
      risks.push({
        code: "missing_trace_context",
        severity: "warning",
        message: "Event is missing trace context.",
        eventName: event.name,
        timestamp: event.timestamp
      });
    }

    if (!event.correlationId) {
      risks.push({
        code: "missing_correlation_context",
        severity: "warning",
        message: "Event is missing correlation context.",
        eventName: event.name,
        timestamp: event.timestamp
      });
    }

    if (!event.journeyId) {
      risks.push({
        code: "missing_journey_context",
        severity: "info",
        message: "Event is missing journey context.",
        eventName: event.name,
        timestamp: event.timestamp
      });
    }
  }

  for (const group of groupErrorEvents(events)) {
    if (group.count < clusterThreshold) {
      continue;
    }

    risks.push({
      code: "error_cluster",
      severity: "error",
      message: `${group.count} errors for ${group.event} in ${group.environment}/${group.surface}.`,
      eventName: group.event
    });
  }

  return risks.sort(compareRisks);
}

function buildNextQueries(events: WideEvent[], pivots: TelemetryInspectionPivots): string[] {
  const queries = new Set<string>();

  for (const traceId of pivots.traceIds.slice(0, 3)) {
    queries.add(`agentstack observe timeline --trace ${traceId}`);
  }

  for (const correlationId of pivots.correlationIds.slice(0, 3)) {
    queries.add(`agentstack observe timeline --correlation ${correlationId}`);
  }

  for (const journeyId of pivots.journeyIds.slice(0, 3)) {
    queries.add(`agentstack observe journey --id ${journeyId}`);
  }

  for (const group of groupErrorEvents(events).slice(0, 3)) {
    const componentFlag = group.component ? ` --component ${group.component}` : "";
    queries.add(`agentstack observe errors --env ${group.environment}${componentFlag}`);
  }

  return Array.from(queries).sort();
}

function compareEvents(a: WideEvent, b: WideEvent): number {
  return (
    a.timestamp.localeCompare(b.timestamp) ||
    a.environment.localeCompare(b.environment) ||
    a.surface.localeCompare(b.surface) ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

function compareRisks(a: TelemetryRisk, b: TelemetryRisk): number {
  return (
    riskSeverityRank(b.severity) - riskSeverityRank(a.severity) ||
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "") ||
    a.code.localeCompare(b.code) ||
    (a.eventName ?? "").localeCompare(b.eventName ?? "")
  );
}

function riskSeverityRank(severity: TelemetryRisk["severity"]): number {
  return severity === "error" ? 3 : severity === "warning" ? 2 : 1;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort();
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined && value !== "";
}
