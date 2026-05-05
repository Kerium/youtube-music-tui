export interface ThemeColors {
  accent: string;
  accentSoft: string;
  background: string;
  danger: string;
  overlay: string;
  panel: string;
  panelActive: string;
  panelMuted: string;
  success: string;
  text: string;
  textMuted: string;
}

export interface ThemeBorderColors {
  active: string;
  default: string;
  subtle: string;
}

export interface ThemeOverrides {
  border?: Partial<ThemeBorderColors>;
  colors?: Partial<ThemeColors>;
}

export const THEME_COLOR_KEYS = [
  "accent",
  "accentSoft",
  "background",
  "danger",
  "overlay",
  "panel",
  "panelActive",
  "panelMuted",
  "success",
  "text",
  "textMuted",
] as const;

export const THEME_BORDER_KEYS = ["active", "default", "subtle"] as const;

const defaultTheme = {
  colors: {
    background: "#101820",
    panel: "#16324f",
    panelMuted: "#1b4467",
    panelActive: "#24557f",
    accent: "#f4a261",
    accentSoft: "#f6bd60",
    text: "#f7f4ea",
    textMuted: "#b9c8d8",
    success: "#6dd3a0",
    danger: "#ff7b72",
    overlay: "rgba(6,12,18,0.76)",
  },
  border: {
    active: "#f4a261",
    default: "#4a6b89",
    subtle: "#2e4b67",
  },
};

export const theme = {
  colors: { ...defaultTheme.colors },
  border: { ...defaultTheme.border },
};

export function sanitizeThemeOverrides(overrides: ThemeOverrides | null | undefined): ThemeOverrides | null {
  if (!overrides) {
    return null;
  }

  const nextColors: Partial<ThemeColors> = {};
  const nextBorder: Partial<ThemeBorderColors> = {};

  for (const colorKey of THEME_COLOR_KEYS) {
    const value = overrides.colors?.[colorKey];

    if (typeof value === "string" && value.trim()) {
      nextColors[colorKey] = value;
    }
  }

  for (const borderKey of THEME_BORDER_KEYS) {
    const value = overrides.border?.[borderKey];

    if (typeof value === "string" && value.trim()) {
      nextBorder[borderKey] = value;
    }
  }

  return Object.keys(nextColors).length > 0 || Object.keys(nextBorder).length > 0
    ? {
        colors: Object.keys(nextColors).length > 0 ? nextColors : undefined,
        border: Object.keys(nextBorder).length > 0 ? nextBorder : undefined,
      }
    : null;
}

export function applyThemeOverrides(overrides: ThemeOverrides | null | undefined) {
  Object.assign(theme.colors, defaultTheme.colors, overrides?.colors ?? {});
  Object.assign(theme.border, defaultTheme.border, overrides?.border ?? {});
}

export function paneBorderColor(isFocused: boolean) {
  return isFocused ? theme.border.active : theme.border.default;
}

export function progressBar(progress: number, total = 20) {
  const safeProgress = Math.max(0, Math.min(progress, 1));
  const filled = Math.round(safeProgress * total);
  return `${"━".repeat(filled)}${"─".repeat(Math.max(0, total - filled))}`;
}