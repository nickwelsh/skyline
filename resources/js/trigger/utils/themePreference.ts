/*!
 * Adapted from Trigger.dev apps/webapp/app/utils/themePreference.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline retains the accepted Classic default while preserving source validation.
 */
import { z } from "zod";

export const ThemePreference = z.enum(["classic", "system", "dark", "light"]);
export type ThemePreference = z.infer<typeof ThemePreference>;

export function normalizeThemePreference(value: unknown): ThemePreference {
  const result = ThemePreference.safeParse(value);
  return result.success ? result.data : "classic";
}

export const DEFAULT_THEME_CONTRAST = 50;

export function normalizeThemeContrast(value: unknown): number {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return DEFAULT_THEME_CONTRAST;
  return Math.min(100, Math.max(0, Math.round(num)));
}
