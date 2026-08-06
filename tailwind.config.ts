import type { Config } from 'tailwindcss'

/**
 * Semantic tokens only — PRD §8. Never a raw hex in a component.
 * Conductor's red is reserved for anomalies and aborts.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        manuscript: {
          DEFAULT: '#F2EEE2',
          raised: '#FAF7EE',
          sunk: '#E7E1D1',
        },
        staff: {
          DEFAULT: '#A8A398',
          faint: '#CFC9BB',
        },
        ink: {
          DEFAULT: '#1D1B17',
          muted: '#5C574C',
        },
        voiceA: {
          DEFAULT: '#2C4C7C',
          wash: '#DDE4EF',
        },
        voiceB: {
          DEFAULT: '#8A6A2E',
          wash: '#EFE6D2',
        },
        voiceC: {
          DEFAULT: '#3F5F4A',
          wash: '#DEE7E0',
        },
        conductor: {
          DEFAULT: '#B03A2E',
          wash: '#F3DED9',
        },
      },
      fontFamily: {
        prose: ['var(--font-prose)', 'Faustina', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'ui-monospace', 'monospace'],
        control: ['var(--font-control)', 'Work Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        leaf: '0 1px 0 0 #E7E1D1, 0 8px 24px -18px rgba(29, 27, 23, 0.45)',
      },
    },
  },
  plugins: [],
}

export default config
