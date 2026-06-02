import { mergeThemeTokens, type ThemeTokenInput, type ThemeTokens } from "./theme-tokens";

const colorVariableMap = {
  background: "--background",
  foreground: "--foreground",
  surface: "--surface",
  surface2: "--surface-2",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  accent: "--accent",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  danger: "--danger",
  success: "--success",
  warning: "--warning"
} as const;

export function applyThemeTokens(
  input?: ThemeTokenInput | ThemeTokens | null,
  target: HTMLElement = document.documentElement
) {
  const tokens = mergeThemeTokens(input);

  Object.entries(colorVariableMap).forEach(([tokenName, variableName]) => {
    const colorName = tokenName as keyof ThemeTokens["colors"];
    target.style.setProperty(variableName, tokens.colors[colorName]);
  });

  target.style.setProperty("--radius-card", tokens.radii.card);
  target.style.setProperty("--radius-button", tokens.radii.button);
  target.style.setProperty("--shadow-card", tokens.shadows.card);
  target.style.setProperty("--shadow-glow", tokens.shadows.glow);
}
