export type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    accent: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
  radius: {
    sm: number;
    md: number;
  };
};

export const defaultTheme: ThemeTokens = {
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    accent: "#2563eb"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24
  },
  radius: {
    sm: 4,
    md: 8
  }
};
