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
  TDefinition extends AppTelemetryDefinition = AppTelemetryDefinition,
  TState extends AppTelemetryState<TDefinition> = AppTelemetryState<TDefinition>
> = AppTelemetryContext & {
  name: TDefinition["name"];
  journey: TDefinition["journey"];
  schemaVersion: TDefinition["schemaVersion"];
  state: TState;
  occurredAt: string;
};

export function createAppEvent<
  TDefinition extends AppTelemetryDefinition
>(
  definition: TDefinition,
  input: AppTelemetryContext & { state: AppTelemetryState<TDefinition>; occurredAt?: string }
): AppTelemetryEnvelope<TDefinition> {
  return {
    appSlug: input.appSlug,
    environment: input.environment,
    surface: input.surface,
    correlationId: input.correlationId,
    traceId: input.traceId,
    name: definition.name,
    journey: definition.journey,
    schemaVersion: definition.schemaVersion,
    state: input.state,
    occurredAt: input.occurredAt ?? new Date().toISOString()
  };
}
