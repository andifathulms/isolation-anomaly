/**
 * The maker's mark: a quiet credit in the site footer, on every page.
 *
 * Deliberately kept separate from the standing statement about what this site
 * models — that is a claim about the work and its evidence, this is a personal
 * signature, and merging the two would let one borrow the other's authority.
 * They are separated by position rather than by another rule, so the footer
 * keeps its single seam.
 *
 * Everything identifying lives in the two constants below, so updating a
 * handle or adding a platform is a one-line change.
 */

const MAKER = {
  name: 'Andi Fathul Mukminin',
  portfolio: 'https://andifathulms.github.io/en/',
} as const

/**
 * `icon` is a 24-unit path set rendered at 18px. The brand marks are filled
 * and the globe is stroked, which is how each reads correctly at that size.
 */
const LINKS = [
  {
    label: 'Portfolio',
    href: MAKER.portfolio,
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <circle cx="12" cy="12" r="9.25" />
        <ellipse cx="12" cy="12" rx="4" ry="9.25" />
        <path d="M3.1 9.2h17.8M3.1 14.8h17.8" />
      </g>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/andifathulms',
    icon: (
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577
          0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633
          17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809
          1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93
          0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3
          1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23
          3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805
          5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0
          .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/andifathulmukminin/',
    icon: (
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136
          2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37
          4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063
          2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0
          23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"
      />
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/andifathulms/',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth={1.7}>
        <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" />
        <circle cx="12" cy="12" r="4.25" />
        <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
      </g>
    ),
  },
] as const

export function MakerSignature() {
  // A static export, so this is the build date — which is what a copyright
  // year on a site that redeploys on every push should say.
  const year = new Date().getFullYear()

  return (
    <div className="md:text-right">
      <p className="text-sm text-ink-muted">
        Designed &amp; built by{' '}
        <a
          href={MAKER.portfolio}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-staff underline-offset-4 transition-colors
            hover:text-voiceA hover:decoration-voiceA"
        >
          {MAKER.name}
        </a>{' '}
        · © <span className="font-mono tabular-nums">{year}</span>
      </p>

      {/* Pulled out by the tap target's own padding, so the first glyph lines
          up with the text edge above it rather than sitting indented — and on
          the other side once the block flips to right-aligned. */}
      <ul className="-ml-1.5 mt-2 flex items-center gap-1 md:-mr-1.5 md:ml-0 md:justify-end">
        {LINKS.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="block rounded-md p-1.5 text-ink-soft transition-colors
                hover:bg-manuscript-sunk hover:text-ink"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" className="block">
                {link.icon}
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
