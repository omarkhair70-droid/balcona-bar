export type ThemeColors = {
  background: string;
  foreground: string;
  surface: string;
  surface2: string;
  surfaceRaised: string;
  surfaceOverlay: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  danger: string;
  success: string;
  warning: string;
};

export type ThemeRadii = {
  card: string;
  button: string;
};

export type ThemeShadows = {
  card: string;
  elevated: string;
  glow: string;
};

export type ThemeTokens = {
  colors: ThemeColors;
  radii: ThemeRadii;
  shadows: ThemeShadows;
};

export type ThemeTokenInput = {
  colors?: Partial<ThemeColors> & {
    text?: string;
    mutedText?: string;
  };
  radii?: Partial<ThemeRadii>;
  shadows?: Partial<ThemeShadows>;
};

export const defaultThemeTokens: ThemeTokens = {
  colors: {
    background: "#120D0A",
    foreground: "#FFF7EA",
    surface: "#1D1510",
    surface2: "#2A1E17",
    surfaceRaised: "#34241B",
    surfaceOverlay: "rgba(29, 21, 16, 0.82)",
    primary: "#C68A4A",
    primaryForeground: "#160F0A",
    accent: "#7A2E2E",
    accentForeground: "#FFF7EA",
    muted: "#2F261F",
    mutedForeground: "#B7A99A",
    border: "#3F3026",
    ring: "#E2B06A",
    danger: "#E0695F",
    success: "#7FC37E",
    warning: "#E0B85F"
  },
  radii: {
    card: "8px",
    button: "8px"
  },
  shadows: {
    card: "0 18px 60px rgba(0, 0, 0, 0.28)",
    elevated: "0 28px 90px rgba(0, 0, 0, 0.42)",
    glow: "0 0 36px rgba(198, 138, 74, 0.18)"
  }
};

export function mergeThemeTokens(tokens?: ThemeTokenInput | null): ThemeTokens {
  return {
    colors: {
      ...defaultThemeTokens.colors,
      ...tokens?.colors,
      foreground:
        tokens?.colors?.foreground ??
        tokens?.colors?.text ??
        defaultThemeTokens.colors.foreground,
      mutedForeground:
        tokens?.colors?.mutedForeground ??
        tokens?.colors?.mutedText ??
        defaultThemeTokens.colors.mutedForeground
    },
    radii: {
      ...defaultThemeTokens.radii,
      ...tokens?.radii
    },
    shadows: {
      ...defaultThemeTokens.shadows,
      ...tokens?.shadows
    }
  };
}
