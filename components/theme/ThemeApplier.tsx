"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/store";
import { applyThemeToDocument } from "@/lib/theme/themes";

/** Keeps <html data-theme> in sync with the signed-in user's saved theme. */
export function ThemeApplier() {
  const { state } = useAuth();
  const theme = state.preferences?.theme;
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);
  return null;
}
