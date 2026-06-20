import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";

export const environmentSchema = z.enum(["development", "preview", "production"]);
export const surfaceSchema = z.enum(["web", "mobile", "convex"]);
export const serviceSchema = z.enum(["clerk", "convex", "vercel", "eas"]);

export const customEnvSchema = z.object({
  surfaces: z.array(surfaceSchema).min(1),
  environments: z.array(environmentSchema).min(1),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  validate: z.string().optional()
});

export const manifestSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/)
  }),
  environments: z.array(environmentSchema).min(1),
  surfaces: z.array(surfaceSchema).min(1),
  services: z.object({
    clerk: z.object({ enabled: z.boolean() }),
    convex: z.object({ enabled: z.boolean() }),
    vercel: z.object({ enabled: z.boolean() }),
    eas: z.object({ enabled: z.boolean() })
  }),
  env: z.object({
    custom: z.record(customEnvSchema)
  }),
  telemetry: z.object({
    enabled: z.boolean(),
    exporter: z.enum(["local", "otlp", "control-plane"]),
    redaction: z.object({
      defaultPolicy: z.enum(["strict", "billing-safe", "debug"]),
      forbidRawSecrets: z.boolean()
    })
  })
});

export type AgentstackManifest = z.infer<typeof manifestSchema>;
export type EnvironmentName = z.infer<typeof environmentSchema>;
export type SurfaceName = z.infer<typeof surfaceSchema>;
export type ServiceName = z.infer<typeof serviceSchema>;

export function createDefaultManifest(slug: string): AgentstackManifest {
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  return {
    app: { name, slug },
    environments: ["development", "preview", "production"],
    surfaces: ["web", "mobile", "convex"],
    services: {
      clerk: { enabled: true },
      convex: { enabled: true },
      vercel: { enabled: true },
      eas: { enabled: true }
    },
    env: {
      custom: {}
    },
    telemetry: {
      enabled: true,
      exporter: "local",
      redaction: {
        defaultPolicy: "strict",
        forbidRawSecrets: true
      }
    }
  };
}

export function parseManifest(input: unknown): Result<AgentstackManifest> {
  const parsed = manifestSchema.safeParse(input);

  if (parsed.success) {
    return pass(parsed.data);
  }

  const diagnostics: Diagnostic[] = parsed.error.issues.map((issue) => ({
    severity: "fail",
    code: "manifest.invalid",
    path: issue.path.join("."),
    message: issue.message,
    fix: "Update agentstack.config.ts so it matches the Agentstack manifest schema.",
    blocks: ["validate", "validate --cloud", "deploy"]
  }));

  return fail(diagnostics);
}
