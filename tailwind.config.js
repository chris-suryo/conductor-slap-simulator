/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // APC Relay brand: navy (#0C3552) + orange (#FD8505) on black.
        // Console surfaces are navy-tinted darks derived from the brand navy.
        base: '#05101a',
        panel: {
          DEFAULT: '#0a1a28',
          muted: '#071320',
          raised: '#0f2638',
        },
        edge: {
          DEFAULT: '#1d3a54',
          soft: '#15293d',
          bright: '#2f5474',
        },
        // APC brand accents
        brand: {
          DEFAULT: '#fd8505', // APC orange (wordmark / primary accent)
          dark: '#d97005',
          light: '#ffab47',
        },
        navy: {
          DEFAULT: '#0c3552', // APC navy
          light: '#164a72',
          dark: '#0a2740',
        },
        // Semantic status colors (functional — kept distinct from brand chrome)
        energized: '#22d3ee', // cyan — line energized / current flowing
        healthy: '#34d399', // emerald — healthy / restored
        caution: '#fbbf24', // amber — near miss / warning
        fault: '#f87171', // red — fault / slap
        arc: '#ff6a4d', // hot orange-red — arc flash
        deenergized: '#64748b', // slate — breaker open / de-energized
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'SF Pro Display',
          'SF Pro Text',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SF Mono',
          'SFMono-Regular',
          'JetBrains Mono',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.7)',
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
