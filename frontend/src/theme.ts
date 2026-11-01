// Design tokens for SILVER-PT. Dark only: black canvas, red laser accents, silver text.
// Keys follow the design_guidelines "color" block convention: plain key = background, `on` key = content on it.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#000000",
  onSurface: "#F4F4F6",
  surfaceSecondary: "#0C0C0E",
  onSurfaceSecondary: "#D2D3D8",
  surfaceTertiary: "#16161A",
  onSurfaceTertiary: "#B5B6BD",
  surfaceInverse: "#E8E8EC",
  onSurfaceInverse: "#000000",
  muted: "#85868F",

  brand: "#E10600",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF1A1A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#1E1E22",
  onBrandSecondary: "#E6E6EA",
  brandTertiary: "#2A0606",
  onBrandTertiary: "#FF5A5A",

  laser: "#FF2020", // neon red line and glow
  silver: "#C4C6CE", // chrome text accents

  success: "#22C55E",
  onSuccess: "#000000",
  warning: "#F59E0B",
  onWarning: "#000000",
  error: "#FF3B3B",
  onError: "#FFFFFF",
  info: "#60A5FA",
  onInfo: "#000000",

  border: "#232328",
  borderStrong: "#FF1A1A",
  divider: "#1A1A1E",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };

export const colors = dark;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
