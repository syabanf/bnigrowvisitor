import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { STATUS_LABEL, type ListResult, type Visitor, type VisitorStatus } from '../api/types'

export default function Visitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (search.trim()) params.set('q', search.trim())
      const query = params.toString()
      const res = await api.get<ListResult<Visitor>>(`/visitors${query ? `?${query}` : ''}`)
      setVisitors(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [status, search])

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 300)
    return () => clearTimeout(timer)
  }, [load])

  const changeStatus = async (visitor: Visitor, next: VisitorStatus) => {
    // Optimistic: the row updates immediately and is rolled back by a reload if
    // the server rejects it.
    setVisitors(prev => prev.map(v => (v.id === visitor.id ? { ...v, status: next } : v)))
    try {
      await api.patch(`/visitors/${visitor.id}`, { ...visitor, status: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
      void load()
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

      <p className="muted small">Menampilkan {visitors.length} dari {total} visitor</p>

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
                      value={v.status}
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
    </>
  )
}
