import themeTokensJson from "../tokens.json";

export type TokenRole =
  | "colors.background"
  | "colors.foreground"
  | "colors.surface"
  | "colors.muted"
  | "colors.accent"
  | "colors.danger"
  | "colors.success"
  | "colors.focusRing";

export type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    surface: string;
    muted: string;
    accent: string;
    danger: string;
    success: string;
    focusRing: string;
  };
  typography: {
    fontFamily: string;
    fontSize: { sm: number; md: number; lg: number };
    lineHeight: { tight: number; normal: number; relaxed: number };
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number };
  shadow: { sm: string; md: string; lg: string };
  motion: { durationFast: number; durationNormal: number; easingStandard: string };
  density: { controlHeight: number; listItemHeight: number };
};

export const themeTokens = themeTokensJson as ThemeTokens;

export const tokenRoles = {
  background: "colors.background",
  foreground: "colors.foreground",
  surface: "colors.surface",
  muted: "colors.muted",
  accent: "colors.accent",
  danger: "colors.danger",
  success: "colors.success",
  focusRing: "colors.focusRing"
} as const satisfies Record<string, TokenRole>;

export function tokenRole(role: TokenRole): TokenRole {
  return role;
}
