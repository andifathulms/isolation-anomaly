import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Citation } from '@/lib/packs/types'

/**
 * A rule, in words, with the vendor's sentence for it — beside the numbers the
 * rule produced rather than in a footnote or on another page.
 *
 * Every citation in this app used to live on the engines page, which meant the
 * reader had to already suspect a rule existed in order to go and find its
 * source. The commitment is that engine claims are attributable; that is only
 * worth something where the claim is made.
 */
export function RuleNote({
  body,
  citation,
  dict,
}: {
  readonly body: string
  readonly citation: Citation
  readonly dict: Dictionary
}) {
  return (
    <div className="mt-3 border-l-2 border-voiceA pl-3">
      <p className="max-w-reading text-body">{body}</p>
      <details className="group mt-1">
        <summary
          className="cursor-pointer list-none font-control text-micro text-ink-soft underline
            decoration-staff underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden"
        >
          {dict.why.source}
        </summary>
        <blockquote className="mt-1.5 border-l border-staff pl-3 text-caption italic text-ink-muted">
          “{citation.quote}”
          <footer className="mt-1 not-italic">
            <a
              href={citation.url}
              className="text-voiceA underline decoration-staff underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {citation.source}
            </a>
          </footer>
        </blockquote>
      </details>
    </div>
  )
}
