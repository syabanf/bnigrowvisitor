import type { ReactNode } from 'react'

interface Props<T> {
  rows: T[]
  columns: { key: string; header: string; render: (row: T) => ReactNode }[]
  loading: boolean
  empty?: string
  rowKey: (row: T) => string
}

export default function Table<T>({ rows, columns, loading, empty, rowKey }: Props<T>) {
  if (loading) return <p className="muted">Memuat…</p>
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
              {columns.map(c => <td key={c.key}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
