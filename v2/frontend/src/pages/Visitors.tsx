import { useState } from 'react'
import { api } from '../api/client'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import Skeleton from '../components/Skeleton'
import StatusSelect from '../components/StatusSelect'
import { STATUS_LABEL, type Visitor, type VisitorStatus } from '../api/types'
import PageHeader from '../components/PageHeader'

// The pipeline reads left to right; only the ends are coloured. Tinting every
// stage would make the list a rainbow in which nothing stands out.
const VISITOR_TONE: Record<VisitorStatus, string> = {
  new: 'pill--quiet',
  followup: 'pill--warn',
  confirmed: 'pill--quiet',
  attended: 'pill--good',
  no_show: 'pill--muted',
  interview: 'pill--quiet',
  member: 'pill--good',
  not_continue: 'pill--muted',
}

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
      <PageHeader title="Visitor" count={`${total.toLocaleString('id-ID')} visitor`} />

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
        <Skeleton columns="2fr 1.5fr 1.5fr 1fr 1fr" />
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
                  <td data-label="Nama">
                    <strong>{v.name}</strong>
                    {v.company && <div className="muted small">{v.company}</div>}
                  </td>
                  <td data-label="Kontak">
                    {v.phone}
                    {v.email && <div className="muted small">{v.email}</div>}
                  </td>
                  <td data-label="Bidang Usaha">{v.business_field || '—'}</td>
                  <td data-label="PIC">{v.pic_name || <span className="muted">Belum ada</span>}</td>
                  <td data-label="Status">
                    <StatusSelect
                      value={pending[v.id] ?? v.status}
                      options={STATUS_LABEL}
                      label={`Status ${v.name}`}
                      tone={s => VISITOR_TONE[s]}
                      onChange={next => void changeStatus(v, next)}
                    />
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
