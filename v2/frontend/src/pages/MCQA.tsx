import { useEffect, useState } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'
import { useResource } from '../hooks/useResource'

interface McqaVisitor {
  id: string
  name: string
  company?: string
  phone: string
  business_field?: string
  meeting_name?: string
  status: string
  attended_choice_number?: number
  attended_choice_note?: string
}

interface Choice {
  number: number
  label: string
}

export default function MCQA() {
  const [search, setSearch] = useState('')
  const [choices, setChoices] = useState<Choice[]>([])
  const { items, total, loading, error, reload, setError } =
    useResource<McqaVisitor>('/mcqa', { q: search })

  // The labels come from the server so the UI cannot drift from the values the
  // API will accept.
  useEffect(() => {
    api.get<{ data: Choice[] }>('/mcqa/choices').then(res => setChoices(res.data)).catch(() => {})
  }, [])

  const record = async (visitor: McqaVisitor, raw: string) => {
    try {
      await api.patch(`/mcqa/${visitor.id}`, {
        // An empty selection clears the result rather than sending 0.
        attended_choice_number: raw === '' ? null : Number(raw),
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hasil airtime.')
    }
  }

  return (
    <>
      <h1>MCQA</h1>
      <p className="muted small">
        Hasil airtime visitor yang sudah hadir. Visitor yang belum hadir tidak muncul di sini —
        mencatat airtime untuk mereka akan merusak laporan.
      </p>

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari nama, perusahaan…"
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert">{error}</div>}
      <p className="muted small">Menampilkan {items.length} dari {total} visitor hadir</p>

      <Table
        rows={items}
        loading={loading}
        rowKey={v => v.id}
        empty="Belum ada visitor yang hadir."
        columns={[
          {
            key: 'name', header: 'Nama',
            render: v => (
              <>
                <strong>{v.name}</strong>
                {v.company && <div className="muted small">{v.company}</div>}
              </>
            ),
          },
          { key: 'field', header: 'Bidang Usaha', render: v => v.business_field || '—' },
          { key: 'meeting', header: 'Meeting', render: v => v.meeting_name || '—' },
          {
            key: 'airtime', header: 'Hasil Airtime',
            render: v => (
              <select
                value={v.attended_choice_number ?? ''}
                aria-label={`Hasil airtime ${v.name}`}
                onChange={e => void record(v, e.target.value)}
              >
                <option value="">Belum dicatat</option>
                {choices.map(c => (
                  <option key={c.number} value={c.number}>{c.label}</option>
                ))}
              </select>
            ),
          },
        ]}
      />
    </>
  )
}
