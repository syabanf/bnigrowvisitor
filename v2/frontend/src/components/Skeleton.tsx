interface Props {
  /** How many placeholder rows to draw. */
  rows?: number
  /** Column widths as a CSS grid template, so the shape matches the real table. */
  columns?: string
}

/**
 * A placeholder for content that is still loading.
 *
 * "Memuat…" tells you the app is working but not what is coming, so the layout
 * jumps when the data lands. A skeleton in the shape of the table means the page
 * is the right size before the first row arrives, and the reflow that follows is
 * nothing.
 *
 * Marked aria-hidden with a live region alongside: a screen reader should hear
 * "memuat" once, not read out a wall of empty boxes.
 */
export default function Skeleton({ rows = 6, columns = '2fr 1.5fr 1.5fr 1fr 1fr' }: Props) {
  return (
    <>
      <span className="sr-only" role="status">Memuat data…</span>
      <div className="skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton__row" style={{ gridTemplateColumns: columns }} key={i}>
            {columns.split(' ').map((_, c) => (
              <span className="skeleton__cell" key={c} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
