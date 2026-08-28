import {
  lightTheme,
  darkTheme,
  THEME_MODES,
  THEME_STORAGE_KEY,
} from './theme/themes';

export { THEME_MODES, THEME_STORAGE_KEY, lightTheme, darkTheme };

/** Live theme object — updated by applyTheme(); import this in components. */
export let theme = { ...lightTheme };

export const kindLabels = lightTheme.kindLabels;
export const kindColors = lightTheme.kindColors;

const CSS_VAR_MAP = {
  bg: '--ls-bg',
  shellBg: '--ls-shell-bg',
  cardBg: '--ls-card-bg',
  border: '--ls-border',
  headerBg: '--ls-header-bg',
  textMain: '--ls-text-main',
  textMuted: '--ls-text-muted',
  primary: '--ls-primary',
  edgeStroke: '--ls-edge-stroke',
  backgroundGrid: '--ls-bg-grid',
  shadowCard: '--ls-shadow-card',
};

export function applyTheme(mode) {
  const next = mode === THEME_MODES.DARK ? darkTheme : lightTheme;
  Object.assign(theme, next);
  kindColors.physical_table = next.kindColors.physical_table;
  Object.assign(kindColors, next.kindColors);

  const root = document.documentElement;
  root.dataset.theme = next.mode;
  root.style.colorScheme = next.mode;

  Object.entries(CSS_VAR_MAP).forEach(([key, varName]) => {
    if (next[key]) root.style.setProperty(varName, next[key]);
  });

  // React Flow may retain a .dark class from older builds — keep canvas in sync
  document.querySelectorAll('.react-flow').forEach((el) => {
    el.classList.remove('dark');
  });
}

export function getInitialThemeMode() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === THEME_MODES.DARK || saved === THEME_MODES.LIGHT) return saved;
  } catch {
    /* private mode / blocked storage */
  }
  if (typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return THEME_MODES.DARK;
  }
  return THEME_MODES.LIGHT;
}

export const minimapNodeColor = (node) => {
  if (node.data?.isSearchMatch) return theme.minimapNodeSearch;
  if (node.type === 'joinNode') return theme.minimapNodeJoin;
  if (node.type === 'unionNode') return theme.minimapNodeUnion;
  if (node.id === 'Final_Output') return theme.minimapNodeOutput;
  return theme.minimapNodeDefault;
};

export const minimapNodeStrokeColor = (node) => {
  if (node.data?.isSearchMatch) return theme.minimapStrokeSearch;
  if (node.type === 'joinNode') return theme.minimapStrokeJoin;
  if (node.type === 'unionNode') return theme.minimapStrokeUnion;
  if (node.id === 'Final_Output') return theme.minimapStrokeOutput;
  return theme.minimapStrokeDefault;
};
