import agentstackConfig from "../../agentstack.config";

export default {
  expo: {
    name: agentstackConfig.app.name,
    slug: agentstackConfig.app.slug,
    scheme: agentstackConfig.app.slug,
    version: "1.0.0",
    orientation: "portrait",
    platforms: ["ios", "android"],
    extra: {
      agentstack: {
        appSlug: agentstackConfig.app.slug,
        surfaces: agentstackConfig.surfaces
      }
    }
  }
};
