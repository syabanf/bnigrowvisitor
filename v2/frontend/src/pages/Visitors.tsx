import { useState } from 'react'
import { api } from '../api/client'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import { STATUS_LABEL, type Visitor, type VisitorStatus } from '../api/types'

export default function Visitors() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const {
    items: visitors, total, loading, error, reload: load, setError,
    page, setPage, pageSize, setPageSize,
  } = useResource<Visitor>('/visitors', { status, q: search.trim() })

  const [pending, setPending] = useState<Record<string, VisitorStatus>>({})

  const changeStatus = async (visitor: Visitor, next: VisitorStatus) => {
    // Optimistic: the row shows the new status immediately and is cleared by a
    // reload either way, so a rejected change cannot leave a stale value on
    // screen. Held separately from the fetched list because that list is owned
    // by the hook and is replaced wholesale on the next page or filter change.
    setPending(prev => ({ ...prev, [visitor.id]: next }))
    try {
      await api.patch(`/visitors/${visitor.id}`, { ...visitor, status: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      await load()
      setPending(prev => {
        const rest = { ...prev }
        delete rest[visitor.id]
        return rest
      })
    }
  }

  return (
    <>
      <h1>Visitor</h1>

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari nama, telepon, email, perusahaan…"
          onChange={e => setSearch(e.target.value)}
        />
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted">Memuat…</p>
      ) : visitors.length === 0 ? (
        <p className="muted">Tidak ada visitor yang cocok.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th><th>Kontak</th><th>Bidang Usaha</th><th>PIC</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map(v => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.name}</strong>
                    {v.company && <div className="muted small">{v.company}</div>}
                  </td>
                  <td>
                    {v.phone}
                    {v.email && <div className="muted small">{v.email}</div>}
                  </td>
                  <td>{v.business_field || '—'}</td>
                  <td>{v.pic_name || <span className="muted">Belum ada</span>}</td>
                  <td>
                    <select
                      value={pending[v.id] ?? v.status}
                      onChange={e => void changeStatus(v, e.target.value as VisitorStatus)}
                      aria-label={`Status ${v.name}`}
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page} pageSize={pageSize} total={total} shown={visitors.length}
        onPage={setPage} onPageSize={setPageSize}
      />
    </>
  )
}
