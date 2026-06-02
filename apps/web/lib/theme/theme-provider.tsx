"use client";

import { type PropsWithChildren, useEffect, useMemo } from "react";
import { applyThemeTokens } from "./apply-theme";
import { mergeThemeTokens, type ThemeTokenInput } from "./theme-tokens";

type ThemeProviderProps = PropsWithChildren<{
  tokens?: ThemeTokenInput | null;
}>;

export function ThemeProvider({ children, tokens }: ThemeProviderProps) {
  const mergedTokens = useMemo(() => mergeThemeTokens(tokens), [tokens]);

  useEffect(() => {
    applyThemeTokens(mergedTokens);
  }, [mergedTokens]);

  return children;
}
