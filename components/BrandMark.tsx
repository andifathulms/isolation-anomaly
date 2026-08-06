/**
 * The mark, from public/favicon.svg.
 *
 * Referenced as a file rather than inlined as JSX on purpose. Its three colours
 * are the brand's — T1's blue, T2's gold, and the anomaly's coral — which are
 * fixed identity, not the app's theme tokens, and inlining them would put raw
 * hex into a component and invite someone to "fix" them to match a palette
 * they are deliberately independent of (PRD §8).
 *
 * It reads as the score in miniature: two transaction lanes crossed by the
 * dashed anomaly line, which is the same cut-line the conductor's mark uses.
 *
 * The kit's ink and paper variants are both shipped and swapped by theme. The
 * ink square is nearly the dark manuscript's own background, so on dark it
 * dissolves and leaves the lanes floating with no mark around them.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function BrandMark({ size = 24 }: { readonly size?: number }) {
  // A fixed-size local SVG needs no optimiser, and a static export sets
  // images: { unoptimized: true } anyway — next/image would only add markup.
  const common = 'shrink-0 rounded-[22%]'
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE}/favicon.svg`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${common} block dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE}/mark-light.svg`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${common} hidden dark:block`}
      />
    </>
  )
}
