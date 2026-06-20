import agentstackConfig from "../../agentstack.config.json";

const config = {
  name: agentstackConfig.app.name,
  slug: agentstackConfig.app.slug,
  scheme: agentstackConfig.app.slug,
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android"],
  extra: {
    agentstack: {
      frameworkVersion: agentstackConfig.frameworkVersion,
      guidanceVersion: agentstackConfig.guidanceVersion,
      environments: agentstackConfig.environments,
      services: {
        eas: agentstackConfig.services.eas
      }
    }
  }
};

export default config;
