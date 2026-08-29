import type { CSSProperties } from "react";
import type {
  ThemeTokenInput,
  ThemeTokens
} from "@/lib/theme/theme-tokens";

export const guestThemeTokens: ThemeTokens = {
  colors: {
    background: "#FFF9F2",
    foreground: "#2B211B",
    surface: "#FFFFFF",
    surface2: "#F7EEE6",
    surfaceRaised: "#FFFFFF",
    surfaceOverlay: "rgba(255, 249, 242, 0.96)",
    primary: "#2F2119",
    primaryForeground: "#FFF7EF",
    accent: "#B7794C",
    accentForeground: "#FFF7EF",
    muted: "#F2E8DE",
    mutedForeground: "#8A7668",
    border: "#E5DBD1",
    ring: "#8B6853",
    danger: "#9C554C",
    success: "#5C8B62",
    warning: "#B7794C"
  },
  radii: {
    card: "22px",
    button: "9999px"
  },
  shadows: {
    card: "0 8px 24px rgba(75, 48, 31, 0.05)",
    elevated: "0 16px 40px rgba(60, 34, 22, 0.12)",
    glow: "0 0 0 rgba(0, 0, 0, 0)"
  }
};

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const guestThemeStyle: ThemeStyle = {
  colorScheme: "light",
  "--background": guestThemeTokens.colors.background,
  "--foreground": guestThemeTokens.colors.foreground,
  "--surface": guestThemeTokens.colors.surface,
  "--surface-2": guestThemeTokens.colors.surface2,
  "--surface-raised": guestThemeTokens.colors.surfaceRaised,
  "--surface-overlay": guestThemeTokens.colors.surfaceOverlay,
  "--primary": guestThemeTokens.colors.primary,
  "--primary-foreground": guestThemeTokens.colors.primaryForeground,
  "--accent": guestThemeTokens.colors.accent,
  "--accent-foreground": guestThemeTokens.colors.accentForeground,
  "--muted": guestThemeTokens.colors.muted,
  "--muted-foreground": guestThemeTokens.colors.mutedForeground,
  "--border": guestThemeTokens.colors.border,
  "--ring": guestThemeTokens.colors.ring,
  "--danger": guestThemeTokens.colors.danger,
  "--success": guestThemeTokens.colors.success,
  "--warning": guestThemeTokens.colors.warning,
  "--radius-card": guestThemeTokens.radii.card,
  "--radius-button": guestThemeTokens.radii.button,
  "--shadow-card": guestThemeTokens.shadows.card,
  "--shadow-elevated": guestThemeTokens.shadows.elevated,
  "--shadow-glow": guestThemeTokens.shadows.glow
};

export function mergeGuestThemeTokens(
  input?: ThemeTokenInput | null
): ThemeTokens {
  const colors = input?.colors;

  return {
    colors: {
      ...guestThemeTokens.colors,
      ...colors,
      foreground:
        colors?.foreground ??
        colors?.text ??
        guestThemeTokens.colors.foreground,
      mutedForeground:
        colors?.mutedForeground ??
        colors?.mutedText ??
        guestThemeTokens.colors.mutedForeground
    },
    radii: {
      ...guestThemeTokens.radii,
      ...input?.radii
    },
    shadows: {
      ...guestThemeTokens.shadows,
      ...input?.shadows
    }
  };
}
