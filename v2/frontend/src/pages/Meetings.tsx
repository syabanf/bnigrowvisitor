import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'
import { formatDate } from '../lib/format'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import PageHeader from '../components/PageHeader'

interface Meeting {
  id: string
  title: string
  meeting_date: string
  location?: string
}

export default function Meetings() {
  const [search, setSearch] = useState('')
  const { items, total, loading, error, reload, setError, page, setPage, pageSize, setPageSize } = useResource<Meeting>('/meetings', { q: search.trim() })
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '' })
  const [saving, setSaving] = useState(false)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await api.post('/meetings', form)
      setForm({ title: '', meeting_date: '', location: '' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan meeting.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (meeting: Meeting) => {
    try {
      await api.delete(`/meetings/${meeting.id}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus meeting.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader title="Weekly Meeting" count={`${total.toLocaleString('id-ID')} meeting`} />

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <h2>Tambah Meeting</h2>
        <form onSubmit={create} className="form-grid">
          <div>
            <label htmlFor="mt-title">Judul</label>
            <input id="mt-title" value={form.title} required
                   onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label htmlFor="mt-date">Tanggal</label>
            <input id="mt-date" type="date" value={form.meeting_date} required
                   onChange={e => setForm({ ...form, meeting_date: e.target.value })} />
          </div>
          <div>
            <label htmlFor="mt-loc">Lokasi</label>
            <input id="mt-loc" value={form.location}
                   onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="form-grid__action">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Tambah'}
            </button>
          </div>
        </form>
      </section>
      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari judul atau lokasi meeting…"
          onChange={e => setSearch(e.target.value)} aria-label="Cari meeting"
        />
      </div>


      <Table
        rows={items}
        loading={loading}
        rowKey={m => m.id}
        empty="Belum ada meeting."
        columns={[
          { key: 'title', header: 'Judul', render: m => <strong>{m.title}</strong> },
          {
            key: 'date', header: 'Tanggal',
            render: m => {
              // Compared as ISO, shown formatted: string comparison on
              // YYYY-MM-DD is exact and timezone-free, while "6 Sep 2026" is
              // what the row should actually read.
              const iso = m.meeting_date.slice(0, 10)
              const shown = formatDate(m.meeting_date)
              // An upcoming meeting is what people are preparing for, so it is
              // worth distinguishing at a glance.
              return iso >= today
                ? <span className="pill pill--warn">{shown} · akan datang</span>
                : shown
            },
          },
          { key: 'loc', header: 'Lokasi', render: m => m.location || '—' },
          {
            key: 'act', header: '',
            render: m => (
              <button className="btn btn--small" onClick={() => void remove(m)}>Hapus</button>
            ),
          },
        ]}
      />

      <Pagination
        page={page} pageSize={pageSize} total={total} shown={items.length}
        onPage={setPage} onPageSize={setPageSize}
      />
    </>
  )
}
