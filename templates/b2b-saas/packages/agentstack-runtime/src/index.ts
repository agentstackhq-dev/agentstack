import {
  createAppEvent,
  createAppJourney,
  createAppSpan,
  redactAppTelemetryState,
  type AppTelemetryDefinition,
  type AppTelemetryIdentity,
  type AppTelemetrySerializableState,
  type AppTelemetryState,
  type AppTelemetryStatus
} from "../../telemetry/src/index.js";

export type RuntimeSurface = "web" | "mobile" | "convex";

export type RuntimeContext = {
  appSlug: string;
  environment: "development" | "preview" | "production";
  surface: RuntimeSurface;
  correlationId?: string;
  traceId?: string;
} & AppTelemetryIdentity;

export function createRuntimeContext(context: RuntimeContext): RuntimeContext {
  return context;
}

export function createAppTelemetry(context: RuntimeContext) {
  return {
    event<TDefinition extends AppTelemetryDefinition>(
      definition: TDefinition,
      state: AppTelemetryState<TDefinition>,
      overrides: Partial<RuntimeContext> & { occurredAt?: string } = {}
    ) {
      return createAppEvent(definition, {
        ...context,
        ...overrides,
        state
      });
    },
    identify(identity: AppTelemetryIdentity) {
      return createAppTelemetry({ ...context, ...identity });
    },
    span(name: string,
      state: AppTelemetrySerializableState = {},
      overrides: Partial<RuntimeContext> & {
        spanId?: string;
        parentSpanId?: string;
        status?: AppTelemetryStatus;
        startedAt?: string;
        endedAt?: string;
        durationMs?: number;
      } = {}
    ) {
      return createAppSpan(name, {
        ...context,
        ...overrides,
        state
      });
    },
    journey(journey: string,
      phase: string,
      state: AppTelemetrySerializableState = {},
      overrides: Partial<RuntimeContext> & { status?: AppTelemetryStatus; occurredAt?: string } = {}
    ) {
      return createAppJourney(journey, phase, {
        ...context,
        ...overrides,
        state
      });
    },
    redact(state: AppTelemetrySerializableState) {
      return redactAppTelemetryState(state);
    }
  };
}
