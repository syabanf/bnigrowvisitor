import Icon from './Icon'

interface Props {
  page: number
  pageSize: number
  total: number
  shown: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
}

const PAGE_SIZES = [25, 50, 100, 200]

/**
 * Page controls for the list screens.
 *
 * Rendered even on a single page: the row count is the only place the UI admits
 * a list is a window onto something larger, and hiding the whole control when
 * it happens to fit makes the interface change shape as data grows.
 */
export default function Pagination({ page, pageSize, total, shown, onPage, onPageSize }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1
  const last = total === 0 ? 0 : first + shown - 1

  return (
    <nav className="pagination" aria-label="Navigasi halaman">
      <p className="pagination__summary" aria-live="polite">
        {total === 0
          ? 'Tidak ada data'
          : `${first}–${last} dari ${total.toLocaleString('id-ID')}`}
      </p>

      <div className="pagination__controls">
        {onPageSize && (
          <label className="pagination__size">
            <select
              value={pageSize}
              onChange={e => onPageSize(Number(e.target.value))}
              aria-label="Baris per halaman"
            >
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>{size} / halaman</option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button" className="btn btn--ghost btn--icon"
          onClick={() => onPage(1)} disabled={current <= 1}
        >
          <Icon name="chevrons-left" label="Halaman pertama" />
        </button>
        <button
          type="button" className="btn btn--ghost btn--icon"
          onClick={() => onPage(current - 1)} disabled={current <= 1}
        >
          <Icon name="chevron-left" label="Halaman sebelumnya" />
        </button>

        <span className="pagination__page">
          Hal. <strong>{current}</strong> / {pages}
        </span>

        <button
          type="button" className="btn btn--ghost btn--icon"
          onClick={() => onPage(current + 1)} disabled={current >= pages}
        >
          <Icon name="chevron-right" label="Halaman berikutnya" />
        </button>
        <button
          type="button" className="btn btn--ghost btn--icon"
          onClick={() => onPage(pages)} disabled={current >= pages}
        >
          <Icon name="chevrons-right" label="Halaman terakhir" />
        </button>
      </div>
    </nav>
  )
}
