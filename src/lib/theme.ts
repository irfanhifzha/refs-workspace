export const THEMES = ['system', 'light', 'dark', 'sepia', 'contrast'] as const

export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  sepia: 'Sepia',
  contrast: 'High contrast',
}

const KEY = 'refs-workspace:theme:v1'

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && THEMES.includes(raw as Theme)) return raw as Theme
  } catch {
    // Storage unavailable; fall back to the system preference.
  }
  return 'system'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // The theme still applies for this session.
  }
}
