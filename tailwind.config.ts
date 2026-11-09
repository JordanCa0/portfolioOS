import type { Config } from 'tailwindcss';

// CSS-variable colors that still support opacity modifiers (bg-accent/20):
// Tailwind substitutes <alpha-value> with the modifier (0.2) or 1.
const withAlpha = (v: string) =>
  `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

// Palette values are CSS variables set by src/themes.ts (index.css :root holds
// the first-paint defaults); applyTheme toggles `.dark` for the dark: variant. No hardcoded hex in components.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        desktop: withAlpha('--color-desktop'),
        glass: 'var(--color-glass)',
        chrome: withAlpha('--color-chrome'),
        accent: {
          DEFAULT: withAlpha('--color-accent'),
          hover: withAlpha('--color-accent-hover'),
          soft: 'var(--color-accent-soft)',
          contrast: 'var(--color-accent-contrast)',
        },
        body: {
          DEFAULT: withAlpha('--color-text'),
          muted: 'var(--color-text-muted)',
        },
        edge: 'var(--color-border)',
        'snap-preview': 'color-mix(in srgb, var(--color-accent) 25%, transparent)',
        term: {
          green: '#6fbf73',
          pink: '#d4889a',
          amber: '#e0a23c',
          close: '#c0392b',
          max: '#4caf6e',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
