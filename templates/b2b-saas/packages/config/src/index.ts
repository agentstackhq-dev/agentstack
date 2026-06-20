export const environments = ["development", "preview", "production"] as const;

export type AppEnvironment = (typeof environments)[number];

export const appConfig = {
  slug: "__APP_SLUG__",
  name: "__APP_NAME__",
  defaultEnvironment: "preview" satisfies AppEnvironment
} as const;
