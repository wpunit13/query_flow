import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  theme as legacyTheme,
  applyTheme,
  getInitialThemeMode,
  lightTheme,
  darkTheme,
  THEME_MODES,
  THEME_STORAGE_KEY,
} from '../theme';

const ThemeContext = createContext(null);

function themeForMode(mode) {
  return mode === THEME_MODES.DARK ? darkTheme : lightTheme;
}

function persistTheme(mode) {
  applyTheme(mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const initial = getInitialThemeMode();
    persistTheme(initial);
    return initial;
  });

  const setMode = useCallback((next) => {
    const resolved =
      next === THEME_MODES.DARK ? THEME_MODES.DARK : THEME_MODES.LIGHT;
    persistTheme(resolved);
    setModeState(resolved);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next =
        current === THEME_MODES.DARK ? THEME_MODES.LIGHT : THEME_MODES.DARK;
      persistTheme(next);
      return next;
    });
  }, []);

  const isDark = mode === THEME_MODES.DARK;
  const resolvedTheme = useMemo(() => themeForMode(mode), [mode]);

  return (
    <ThemeContext.Provider
      value={{ mode, isDark, setMode, toggleMode, theme: resolvedTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: THEME_MODES.LIGHT,
      isDark: false,
      setMode: () => {},
      toggleMode: () => {},
      theme: legacyTheme,
    };
  }
  return ctx;
}
