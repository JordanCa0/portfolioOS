export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  colors: {
    desktop: string;
    glass: string;
    chrome: string;
    accent: string;
    accentHover: string;
    accentSoft: string;
    accentContrast: string;
    text: string;
    textMuted: string;
    border: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'parchment',
    name: 'Parchment',
    dark: false,
    colors: {
      desktop: '#ece1cb',
      glass: 'rgba(250, 243, 227, 0.85)',
      chrome: 'rgba(239, 228, 205, 0.92)',
      accent: '#8b1a1a',
      accentHover: '#c0392b',
      accentSoft: '#a05a6a',
      accentContrast: '#f5ead8',
      text: '#3d2a2a',
      textMuted: '#8a6f5f',
      border: 'rgba(139, 90, 60, 0.3)',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    dark: true,
    colors: {
      desktop: '#0d0505',
      glass: 'rgba(30, 8, 8, 0.85)',
      chrome: 'rgba(20, 6, 6, 0.92)',
      accent: '#8b1a1a',
      accentHover: '#c0392b',
      accentSoft: '#d4889a',
      accentContrast: '#f0d0d0',
      text: '#f0d0d0',
      textMuted: '#a08080',
      border: 'rgba(180, 60, 60, 0.25)',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    dark: true,
    colors: {
      desktop: '#242933',
      glass: 'rgba(46, 52, 64, 0.85)',
      chrome: 'rgba(37, 42, 52, 0.92)',
      accent: '#5e81ac',
      accentHover: '#81a1c1',
      accentSoft: '#88c0d0',
      accentContrast: '#eceff4',
      text: '#eceff4',
      textMuted: '#9aa5b5',
      border: 'rgba(136, 192, 208, 0.25)',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    dark: true,
    colors: {
      desktop: '#1d2021',
      glass: 'rgba(40, 40, 40, 0.85)',
      chrome: 'rgba(29, 32, 33, 0.92)',
      accent: '#d79921',
      accentHover: '#fabd2f',
      accentSoft: '#b8bb26',
      accentContrast: '#1d2021',
      text: '#ebdbb2',
      textMuted: '#a89984',
      border: 'rgba(215, 153, 33, 0.25)',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    dark: true,
    colors: {
      desktop: '#11111b',
      glass: 'rgba(30, 30, 46, 0.85)',
      chrome: 'rgba(24, 24, 37, 0.92)',
      accent: '#cba6f7',
      accentHover: '#f5c2e7',
      accentSoft: '#89b4fa',
      accentContrast: '#11111b',
      text: '#cdd6f4',
      textMuted: '#9399b2',
      border: 'rgba(203, 166, 247, 0.25)',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    dark: true,
    colors: {
      desktop: '#16161e',
      glass: 'rgba(26, 27, 38, 0.85)',
      chrome: 'rgba(22, 22, 30, 0.92)',
      accent: '#7aa2f7',
      accentHover: '#bb9af7',
      accentSoft: '#7dcfff',
      accentContrast: '#1a1b26',
      text: '#c0caf5',
      textMuted: '#787c99',
      border: 'rgba(122, 162, 247, 0.25)',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    dark: false,
    colors: {
      desktop: '#f2e9e1',
      glass: 'rgba(250, 244, 237, 0.85)',
      chrome: 'rgba(242, 233, 225, 0.92)',
      accent: '#b4637a',
      accentHover: '#d7827e',
      accentSoft: '#907aa9',
      accentContrast: '#faf4ed',
      text: '#575279',
      textMuted: '#797593',
      border: 'rgba(180, 99, 122, 0.3)',
    },
  },
];

export const DEFAULT_THEME_ID = 'parchment';

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Resolve the persisted theme id, migrating the old 'dark'/'light' values. */
export function loadThemeId(): string {
  const stored = localStorage.getItem('theme');
  if (!stored) return DEFAULT_THEME_ID;
  if (THEMES.some((t) => t.id === stored)) return stored;
  return stored === 'dark' ? 'crimson' : DEFAULT_THEME_ID;
}

export function applyTheme(theme: Theme): void {
  const s = document.documentElement.style;
  const c = theme.colors;
  s.setProperty('--color-desktop', c.desktop);
  s.setProperty('--color-glass', c.glass);
  s.setProperty('--color-chrome', c.chrome);
  s.setProperty('--color-accent', c.accent);
  s.setProperty('--color-accent-hover', c.accentHover);
  s.setProperty('--color-accent-soft', c.accentSoft);
  s.setProperty('--color-accent-contrast', c.accentContrast);
  s.setProperty('--color-text', c.text);
  s.setProperty('--color-text-muted', c.textMuted);
  s.setProperty('--color-border', c.border);
  // Drives Tailwind's `dark:` variant and native controls/scrollbars
  document.documentElement.classList.toggle('dark', theme.dark);
  s.colorScheme = theme.dark ? 'dark' : 'light';
}
