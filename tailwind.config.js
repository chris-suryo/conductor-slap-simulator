/** @type {import('tailwindcss').Config} */
//
// Colors map to CSS custom properties (declared in src/index.css + brand vars from
// src/theme/brand.ts via applyTheme). The `rgb(var(--token) / <alpha-value>)` form keeps
// Tailwind opacity modifiers (e.g. `bg-panel/50`) working AND lets every utility flip with
// the dark/light theme automatically — see src/theme/tokens.ts.
//
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces (swap per theme)
        base: withVar('--base'),
        panel: {
          DEFAULT: withVar('--panel'),
          muted: withVar('--panel-muted'),
          raised: withVar('--panel-raised'),
        },
        edge: {
          DEFAULT: withVar('--edge'),
          soft: withVar('--edge-soft'),
          bright: withVar('--edge-bright'),
        },
        scene: withVar('--scene-bg'),
        // Semantic text (swap per theme) — `text-fg`, `text-fg-muted`, `text-fg-faint`
        fg: {
          DEFAULT: withVar('--text-1'),
          muted: withVar('--text-2'),
          faint: withVar('--text-3'),
        },
        // APC brand accents (from brand.ts; constant across themes)
        brand: {
          DEFAULT: withVar('--brand'),
          dark: withVar('--brand-dark'),
          light: withVar('--brand-light'),
        },
        navy: {
          DEFAULT: withVar('--navy'),
          light: withVar('--navy-light'),
          dark: withVar('--navy-dark'),
        },
        'on-accent': withVar('--on-accent'),
        // Semantic status colors (constant across themes — functional meaning)
        energized: withVar('--energized'),
        healthy: withVar('--healthy'),
        caution: withVar('--caution'),
        fault: withVar('--fault'),
        arc: withVar('--arc'),
        deenergized: withVar('--deenergized'),
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans Variable',
          'IBM Plex Sans',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'SF Mono',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -16px rgba(2,8,18,0.55)',
        'panel-light': '0 1px 2px 0 rgba(15,23,42,0.04), 0 12px 28px -18px rgba(15,23,42,0.22)',
        glow: '0 0 24px -4px var(--tw-shadow-color)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '45%': { opacity: '0.78' },
          '60%': { opacity: '1' },
          '72%': { opacity: '0.85' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        flicker: 'flicker 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
