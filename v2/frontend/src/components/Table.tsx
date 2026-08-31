import type { ReactNode } from 'react'
import Skeleton from './Skeleton'

interface Props<T> {
  rows: T[]
  columns: { key: string; header: string; render: (row: T) => ReactNode }[]
  loading: boolean
  empty?: string
  rowKey: (row: T) => string
}

export default function Table<T>({ rows, columns, loading, empty, rowKey }: Props<T>) {
  // A skeleton in the table's own shape rather than a line of text, so the page
  // is already the right size when the rows arrive.
  if (loading) {
    return <Skeleton columns={columns.map(() => '1fr').join(' ')} />
  }
  if (rows.length === 0) return <p className="muted">{empty ?? 'Belum ada data.'}</p>

  return (
    // Wide tables scroll inside their own box so the page never scrolls sideways.
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={rowKey(row)}>
              {/* The header travels with the cell so the phone layout can put
                  it back: below the table breakpoint each row becomes a card
                  and every value needs its own label, which a <th> in a
                  scrolled-away header row cannot provide. */}
              {columns.map(c => (
                <td key={c.key} data-label={c.header}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
