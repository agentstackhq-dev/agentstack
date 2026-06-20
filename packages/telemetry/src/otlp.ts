import type { WideEvent } from "./events.js";

export type OtlpAnyValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { doubleValue: number };

export type OtlpKeyValue = {
  key: string;
  value: OtlpAnyValue;
};

export type OtlpLogRecord = {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityText: "INFO" | "WARN" | "ERROR";
  body: { stringValue: string };
  attributes: OtlpKeyValue[];
};

export type OtlpLogsRequest = {
  resourceLogs: [
    {
      resource: {
        attributes: OtlpKeyValue[];
      };
      scopeLogs: [
        {
          scope: {
            name: "agentstack.telemetry";
          };
          logRecords: OtlpLogRecord[];
        }
      ];
    }
  ];
};

export type OtlpLogsOptions = {
  serviceName: string;
  serviceVersion?: string;
};

const metadataKeys = [
  "id",
  "schemaVersion",
  "environment",
  "surface",
  "component",
  "command",
  "status",
  "journey",
  "traceId",
  "correlationId",
  "journeyId",
  "actorId",
  "orgId",
  "releaseId"
] as const satisfies readonly (keyof WideEvent)[];

export function wideEventsToOtlpLogsRequest(
  events: WideEvent[],
  options: OtlpLogsOptions
): OtlpLogsRequest {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: compactAttributes([
            ["service.name", options.serviceName],
            ["service.version", options.serviceVersion],
            ["telemetry.sdk.name", "agentstack"]
          ])
        },
        scopeLogs: [
          {
            scope: {
              name: "agentstack.telemetry"
            },
            logRecords: events.map(eventToLogRecord)
          }
        ]
      }
    ]
  };
}

function eventToLogRecord(event: WideEvent): OtlpLogRecord {
  const timeUnixNano = isoToUnixNanoString(event.timestamp, event.name);

  return {
    timeUnixNano,
    observedTimeUnixNano: timeUnixNano,
    severityText: severityTextForStatus(event.status),
    body: { stringValue: event.name },
    attributes: eventAttributes(event)
  };
}

function eventAttributes(event: WideEvent): OtlpKeyValue[] {
  const attributes = compactAttributes(
    metadataKeys.map((key) => [`agentstack.${key}`, event[key]] as const)
  );

  for (const [key, value] of flattenState(event.state)) {
    attributes.push({
      key: `agentstack.state.${key}`,
      value: toOtlpAnyValue(value)
    });
  }

  return attributes;
}

function compactAttributes(entries: readonly (readonly [string, unknown])[]): OtlpKeyValue[] {
  return entries.flatMap(([key, value]) =>
    value === undefined ? [] : [{ key, value: toOtlpAnyValue(value) }]
  );
}

function flattenState(
  value: Record<string, unknown>,
  prefix?: string
): readonly (readonly [string, unknown])[] {
  return Object.entries(value).flatMap(([key, childValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(childValue)) {
      return flattenState(childValue, path);
    }

    return [[path, childValue] as const];
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toOtlpAnyValue(value: unknown): OtlpAnyValue {
  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { boolValue: value };
  }

  if (typeof value === "number") {
    return { doubleValue: value };
  }

  return { stringValue: JSON.stringify(value) };
}

function isoToUnixNanoString(timestamp: string, eventName: string): string {
  const milliseconds = Date.parse(timestamp);
  if (Number.isNaN(milliseconds)) {
    throw new Error(`Invalid telemetry timestamp for ${eventName}: ${timestamp}`);
  }

  return String(BigInt(milliseconds) * 1_000_000n);
}

function severityTextForStatus(status: string | undefined): OtlpLogRecord["severityText"] {
  const normalized = status?.toLowerCase();

  if (normalized === "failed" || normalized === "error") {
    return "ERROR";
  }

  if (normalized === "warn" || normalized === "warning") {
    return "WARN";
  }

  return "INFO";
}
