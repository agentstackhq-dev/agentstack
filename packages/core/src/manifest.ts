import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";

export const environmentSchema = z.enum(["development", "preview", "production"]);
export const surfaceSchema = z.enum(["web", "mobile", "convex"]);
export const serviceSchema = z.enum(["clerk", "convex", "vercel", "eas"]);
export const serviceModeSchema = z.enum(["managed", "external", "manual"]);
export const telemetryLevelSchema = z.enum(["off", "debug", "journey", "audit"]);
export const expectedAgentstackGuidanceVersion = "2026-06-20";

const allEnvironments = ["development", "preview", "production"] as const;

const serviceConfigSchema = (provider: z.infer<typeof serviceSchema>) =>
  z
    .object({
      enabled: z.boolean(),
      provider: serviceSchema.default(provider),
      mode: serviceModeSchema.default("managed"),
      requiredEnvironments: z.array(environmentSchema).default([...allEnvironments])
    })
    .strict();

const telemetryEnvironmentPolicySchema = z
  .object({
    required: z.boolean(),
    level: telemetryLevelSchema
  })
  .strict();

export const customEnvSchema = z.object({
  surfaces: z.array(surfaceSchema).min(1),
  environments: z.array(environmentSchema).min(1),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  validate: z.string().optional()
}).strict();

export const manifestSchema = z.object({
  frameworkVersion: z.string().min(1).default("0.0.0"),
  guidanceVersion: z.string().min(1).default(expectedAgentstackGuidanceVersion),
  app: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/)
  }).strict(),
  environments: z.array(environmentSchema).min(1),
  surfaces: z.array(surfaceSchema).min(1),
  services: z.object({
    clerk: serviceConfigSchema("clerk"),
    convex: serviceConfigSchema("convex"),
    vercel: serviceConfigSchema("vercel"),
    eas: serviceConfigSchema("eas")
  }).strict(),
  env: z.object({
    custom: z.record(customEnvSchema)
  }).strict(),
  telemetry: z.object({
    enabled: z.boolean(),
    exporter: z.enum(["local", "otlp", "control-plane"]),
    environments: z
      .object({
        development: telemetryEnvironmentPolicySchema,
        preview: telemetryEnvironmentPolicySchema,
        production: telemetryEnvironmentPolicySchema
      })
      .strict()
      .default({
        development: { required: false, level: "debug" },
        preview: { required: true, level: "journey" },
        production: { required: true, level: "journey" }
      }),
    redaction: z.object({
      defaultPolicy: z.enum(["strict", "billing-safe", "debug"]),
      forbidRawSecrets: z.boolean()
    }).strict()
  }).strict(),
  generated: z.object({
    requiredAnchors: z.array(z.string().min(1)).default([])
  }).strict()
}).strict();

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

  const candidate = {
    frameworkVersion: "0.0.0",
    guidanceVersion: expectedAgentstackGuidanceVersion,
    app: { name, slug },
    environments: ["development", "preview", "production"],
    surfaces: ["web", "mobile", "convex"],
    services: {
      clerk: {
        enabled: true,
        provider: "clerk",
        mode: "managed",
        requiredEnvironments: ["development", "preview", "production"]
      },
      convex: {
        enabled: true,
        provider: "convex",
        mode: "managed",
        requiredEnvironments: ["development", "preview", "production"]
      },
      vercel: {
        enabled: true,
        provider: "vercel",
        mode: "managed",
        requiredEnvironments: ["development", "preview", "production"]
      },
      eas: {
        enabled: true,
        provider: "eas",
        mode: "managed",
        requiredEnvironments: ["development", "preview", "production"]
      }
    },
    env: {
      custom: {}
    },
    telemetry: {
      enabled: true,
      exporter: "local",
      environments: {
        development: { required: false, level: "debug" },
        preview: { required: true, level: "journey" },
        production: { required: true, level: "journey" }
      },
      redaction: {
        defaultPolicy: "strict",
        forbidRawSecrets: true
      }
    },
    generated: {
      requiredAnchors: []
    }
  };

  return manifestSchema.parse(candidate);
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
    fix: "Update agentstack.config.json so it matches the Agentstack manifest schema.",
    blocks: ["validate", "validate --cloud", "deploy"]
  }));

  return fail(diagnostics);
}
