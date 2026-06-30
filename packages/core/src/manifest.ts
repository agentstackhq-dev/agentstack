import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";

export const environmentSchema = z.enum(["development", "preview", "production"]);
export const surfaceSchema = z.enum(["web", "mobile", "convex"]);
export const serviceSchema = z.enum(["clerk", "convex", "vercel", "eas"]);
export const serviceModeSchema = z.enum(["managed", "external", "manual"]);
export const telemetryLevelSchema = z.enum(["off", "debug", "journey", "audit"]);
export const providerEnvSourceSchema = z.enum(["local-value", "provider-owned"]);
export const expectedAgentstackGuidanceVersion = "2026-06-20";

const allEnvironments = ["development", "preview", "production"] as const;
const entitlementKeyPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;
const providerSlugPattern = /^[a-z][a-z0-9_]*$/;

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

const billingEventSchema = z.enum([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.past_due",
  "subscriptionItem.created",
  "subscriptionItem.updated",
  "subscriptionItem.active",
  "subscriptionItem.canceled",
  "subscriptionItem.ended",
  "subscriptionItem.past_due"
]);

const billingEntitlementSchema = z
  .object({
    providerFeature: z.string().regex(providerSlugPattern),
    providerPlan: z.string().regex(providerSlugPattern),
    scope: z.enum(["workspace"]),
    payer: z.enum(["organization", "user"])
  })
  .strict();

const billingSchema = z
  .object({
    provider: z.enum(["clerk"]),
    requiredEnvironments: z.array(environmentSchema).min(1),
    entitlements: z.record(billingEntitlementSchema),
    webhook: z
      .object({
        service: z.literal("convex"),
        route: z.string().regex(/^\/[a-z0-9][a-z0-9/_-]*$/),
        events: z.array(billingEventSchema).min(1)
      })
      .strict()
  })
  .strict()
  .superRefine((billing, context) => {
    for (const entitlementKey of Object.keys(billing.entitlements)) {
      if (!entitlementKeyPattern.test(entitlementKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entitlements", entitlementKey],
          message: `Invalid entitlement key "${entitlementKey}".`
        });
      }
    }
  });

export const providerTargetSchema = z
  .object({
    service: serviceSchema,
    surfaces: z.array(surfaceSchema).min(1),
    environments: z.array(environmentSchema).min(1),
    source: providerEnvSourceSchema.default("local-value")
  })
  .strict();

export const customEnvSchema = z
  .object({
    surfaces: z.array(surfaceSchema).min(1),
    environments: z.array(environmentSchema).min(1),
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    validate: z.string().optional(),
    providerTargets: z.array(providerTargetSchema).min(1)
  })
  .strict()
  .superRefine((declaration, context) => {
    declaration.providerTargets.forEach((target, targetIndex) => {
      target.surfaces.forEach((surface, surfaceIndex) => {
        if (!declaration.surfaces.includes(surface)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["providerTargets", targetIndex, "surfaces", surfaceIndex],
            message: `${target.service} provider target surface ${surface} is not declared for this custom env.`
          });
        }
      });

      target.environments.forEach((environment, environmentIndex) => {
        if (!declaration.environments.includes(environment)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["providerTargets", targetIndex, "environments", environmentIndex],
            message: `${target.service} provider target environment ${environment} is not declared for this custom env.`
          });
        }
      });
    });
  });

export const manifestSchema = z
  .object({
    frameworkVersion: z.string().min(1).default("0.1.0-beta.4"),
    guidanceVersion: z.string().min(1).default(expectedAgentstackGuidanceVersion),
    app: z
      .object({
        name: z.string().min(1),
        slug: z.string().regex(/^[a-z0-9-]+$/)
      })
      .strict(),
    environments: z.array(environmentSchema).min(1),
    surfaces: z.array(surfaceSchema).min(1),
    services: z
      .object({
        clerk: serviceConfigSchema("clerk"),
        convex: serviceConfigSchema("convex"),
        vercel: serviceConfigSchema("vercel"),
        eas: serviceConfigSchema("eas")
      })
      .strict(),
    env: z
      .object({
        custom: z.record(customEnvSchema)
      })
      .strict(),
    telemetry: z
      .object({
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
        redaction: z
          .object({
            defaultPolicy: z.enum(["strict", "billing-safe", "debug"]),
            forbidRawSecrets: z.boolean()
          })
          .strict()
      })
      .strict(),
    billing: billingSchema,
    generated: z
      .object({
        requiredAnchors: z.array(z.string().min(1)).default([])
      })
      .strict()
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const [name, declaration] of Object.entries(manifest.env.custom)) {
      declaration.providerTargets.forEach((target, targetIndex) => {
        const serviceConfig = manifest.services[target.service];
        if (!serviceConfig.enabled) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["env", "custom", name, "providerTargets", targetIndex, "service"],
            message: `${target.service} provider target is disabled.`
          });
        }

        target.environments.forEach((environment, environmentIndex) => {
          if (!serviceConfig.requiredEnvironments.includes(environment)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["env", "custom", name, "providerTargets", targetIndex, "environments", environmentIndex],
              message: `${target.service} is not active in ${environment}.`
            });
          }
        });
      });
    }

    if (manifest.billing.provider === "clerk" && !manifest.services.clerk.enabled) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billing", "provider"],
        message: "clerk is disabled for Clerk Billing."
      });
    }

    if (manifest.billing.webhook.service === "convex" && !manifest.services.convex.enabled) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billing", "webhook", "service"],
        message: "convex is disabled for Clerk Billing webhook delivery."
      });
    }

    manifest.billing.requiredEnvironments.forEach((environment, environmentIndex) => {
      if (!manifest.services.clerk.requiredEnvironments.includes(environment)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billing", "requiredEnvironments", environmentIndex],
          message: `${manifest.billing.provider} is not active in ${environment} for Clerk Billing.`
        });
      }

      if (!manifest.services.convex.requiredEnvironments.includes(environment)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billing", "requiredEnvironments", environmentIndex],
          message: `convex is not active in ${environment} for Clerk Billing webhook delivery.`
        });
      }
    });
  });

export type AgentstackManifest = z.infer<typeof manifestSchema>;
export type AgentstackConfigInput = z.input<typeof manifestSchema>;
export type EnvironmentName = z.infer<typeof environmentSchema>;
export type SurfaceName = z.infer<typeof surfaceSchema>;
export type ServiceName = z.infer<typeof serviceSchema>;
export type ProviderEnvSource = z.infer<typeof providerEnvSourceSchema>;

export function defineAgentstackConfig(input: AgentstackConfigInput): AgentstackManifest {
  return manifestSchema.parse(input);
}

export function createDefaultManifest(slug: string): AgentstackManifest {
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  const candidate = {
    frameworkVersion: "0.1.0-beta.4",
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
    billing: {
      provider: "clerk",
      requiredEnvironments: ["preview", "production"],
      entitlements: {
        "feature.auditLog": {
          providerFeature: "audit_log",
          providerPlan: "agentstack_m3_audit_log",
          scope: "workspace",
          payer: "organization"
        }
      },
      webhook: {
        service: "convex",
        route: "/agentstack/webhooks/clerk/billing",
        events: [
          "subscription.created",
          "subscription.updated",
          "subscription.active",
          "subscription.past_due",
          "subscriptionItem.created",
          "subscriptionItem.updated",
          "subscriptionItem.active",
          "subscriptionItem.canceled",
          "subscriptionItem.ended",
          "subscriptionItem.past_due"
        ]
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
    fix: "Update agentstack.config.ts so it matches the Agentstack manifest schema.",
    blocks: ["validate", "validate --cloud", "deploy"]
  }));

  return fail(diagnostics);
}
