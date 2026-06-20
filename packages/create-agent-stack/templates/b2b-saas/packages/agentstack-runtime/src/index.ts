import {
  createAppEvent,
  type AppTelemetryDefinition,
  type AppTelemetryState
} from "../../telemetry/src/index.js";

export type RuntimeSurface = "web" | "mobile" | "convex";

export type RuntimeContext = {
  appSlug: string;
  environment: "development" | "preview" | "production";
  surface: RuntimeSurface;
  correlationId?: string;
  traceId?: string;
};

export function createRuntimeContext(context: RuntimeContext): RuntimeContext {
  return context;
}

export function createAppTelemetry(context: RuntimeContext) {
  return {
    event<TDefinition extends AppTelemetryDefinition>(
      definition: TDefinition,
      state: AppTelemetryState<TDefinition>,
      overrides: Partial<Pick<RuntimeContext, "correlationId" | "traceId">> & { occurredAt?: string } = {}
    ) {
      return createAppEvent(definition, {
        ...context,
        ...overrides,
        state
      });
    }
  };
}
