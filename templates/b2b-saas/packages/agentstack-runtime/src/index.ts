export type RuntimeSurface = "web" | "mobile" | "convex";

export type RuntimeContext = {
  appSlug: string;
  environment: "development" | "preview" | "production";
  surface: RuntimeSurface;
};

export function createRuntimeContext(context: RuntimeContext): RuntimeContext {
  return context;
}
