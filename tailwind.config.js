/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Console surfaces (deep, slightly blue-tinted near-black)
        base: '#070a10',
        panel: {
          DEFAULT: '#0e141d',
          muted: '#0a0f17',
          raised: '#131b26',
        },
        edge: {
          DEFAULT: '#1d2734',
          soft: '#161e29',
          bright: '#2b3a4d',
        },
        // Semantic status colors
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
