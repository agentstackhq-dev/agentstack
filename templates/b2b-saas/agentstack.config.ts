import { defineAgentstackConfig } from "@agentstackhq/agentstack/config";

export default defineAgentstackConfig({
  frameworkVersion: "0.1.0-beta.3",
  app: {
    name: "__APP_NAME__",
    slug: "__APP_SLUG__"
  },
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
      requiredEnvironments: ["preview", "production"]
    },
    eas: {
      enabled: true,
      provider: "eas",
      mode: "managed",
      requiredEnvironments: ["preview", "production"]
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
});
