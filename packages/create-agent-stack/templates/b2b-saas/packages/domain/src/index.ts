export type Role = "owner" | "admin" | "member";

export type Entitlement = {
  key: string;
  enabled: boolean;
};

export * from "./saas-spine.js";
