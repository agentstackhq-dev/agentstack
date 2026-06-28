import { defineAgentstackConfig } from "agentstack/config";

export default defineAgentstackConfig({
  frameworkVersion: "0.0.0",
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
    custom: {
      STRIPE_MODE: {
        surfaces: ["convex"],
        environments: ["preview", "production"],
        required: false,
        secret: false,
        validate: "test|live",
        providerTargets: [
          {
            service: "convex",
            surfaces: ["convex"],
            environments: ["preview", "production"],
            source: "local-value"
          }
        ]
      }
    }
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
});
