import type { Config } from 'tailwindcss'

/**
 * Semantic tokens only — PRD §8. Never a raw hex in a component.
 * Conductor's red is reserved for anomalies and aborts.
 *
 * Every colour resolves through a CSS custom property rather than a literal, so
 * the same token names carry both the light manuscript and the lamp-lit dark
 * one. The channel triplets live in globals.css; a component never learns which
 * theme it is in. `<alpha-value>` is preserved, so `bg-conductor-wash/40` and
 * `border-staff-faint/60` keep working exactly as before.
 */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  /*
   * Colour is handled entirely by the custom properties below, so `dark:` is
   * needed only where the two themes need genuinely different content rather
   * than a different value — swapping the brand mark for its light variant,
   * which is a different file and not a token.
   */
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        manuscript: {
          /** The page. */
          DEFAULT: token('--manuscript'),
          /** A leaf laid on the page — panels, the score, the control bar. */
          raised: token('--manuscript-raised'),
          /** Pressed into the page — the selected row, a table header. */
          sunk: token('--manuscript-sunk'),
        },
        staff: {
          /** A rule you are meant to notice: panel edges, table borders. */
          DEFAULT: token('--staff'),
          /** A rule you are not: stave lines, bar lines, hairline dividers. */
          faint: token('--staff-faint'),
        },
        ink: {
          DEFAULT: token('--ink'),
          /** Secondary prose. Carries real body text, so it stays readable. */
          muted: token('--ink-muted'),
          /** Tertiary — labels and asides only, never a whole sentence. */
          soft: token('--ink-soft'),
        },
        voiceA: {
          DEFAULT: token('--voice-a'),
          wash: token('--voice-a-wash'),
        },
        voiceB: {
          DEFAULT: token('--voice-b'),
          wash: token('--voice-b-wash'),
        },
        voiceC: {
          DEFAULT: token('--voice-c'),
          wash: token('--voice-c-wash'),
        },
        conductor: {
          DEFAULT: token('--conductor'),
          wash: token('--conductor-wash'),
        },
      },
      fontFamily: {
        prose: ['var(--font-prose)', 'Faustina', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'ui-monospace', 'monospace'],
        control: ['var(--font-control)', 'Work Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /**
         * A scale rather than a pile of sizes. `display` and `title` are fluid,
         * so a long serif headline is not set small on a phone just to keep it
         * from wrapping into a wall.
         */
        display: ['clamp(2rem, 1.25rem + 2.6vw, 3.1rem)', { lineHeight: '1.08', letterSpacing: '-0.018em' }],
        title: ['clamp(1.6rem, 1.25rem + 1.2vw, 2.2rem)', { lineHeight: '1.15', letterSpacing: '-0.012em' }],
        section: ['1.3rem', { lineHeight: '1.3', letterSpacing: '-0.006em' }],
        lead: ['1.125rem', { lineHeight: '1.65' }],
        /** Uppercase eyebrow labels — sized up from 11px, with real tracking. */
        label: ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.09em' }],
      },
      boxShadow: {
        leaf: '0 1px 0 0 rgb(var(--shadow-edge)), 0 10px 28px -20px rgb(var(--shadow-cast) / 0.5)',
        lift: '0 1px 0 0 rgb(var(--shadow-edge)), 0 18px 44px -26px rgb(var(--shadow-cast) / 0.55)',
      },
      maxWidth: {
        /** About 68 characters of Faustina — a comfortable measure. */
        reading: '38rem',
      },
    },
  },
  plugins: [],
}

export default config
