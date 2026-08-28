import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import Icon from '../components/Icon'

interface Organization { id: string; name: string; code: string }
interface City { id: string; organization_id: string; name: string }
interface Area { id: string; city_id: string; name: string }
interface Chapter { id: string; area_id: string; name: string; display_name: string; is_active: boolean }
interface ChapterDomain { id: string; chapter_id: string; domain: string; type: string; is_primary: boolean }

interface MasterData {
  organizations: Organization[]
  cities: City[]
  areas: Area[]
  chapters: Chapter[]
  domains: ChapterDomain[]
}

export default function Master() {
  const [data, setData] = useState<MasterData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [city, setCity] = useState({ organization_id: '', name: '' })
  const [area, setArea] = useState({ city_id: '', name: '' })
  const [chapter, setChapter] = useState({ area_id: '', name: '', display_name: '' })

  const load = async () => {
    try {
      const res = await api.get<MasterData>('/master')
      setData(res)
      // Preselect the only sensible parent so the forms are usable immediately
      // instead of starting on an empty select.
      setCity(c => ({ ...c, organization_id: c.organization_id || res.organizations[0]?.id || '' }))
      setArea(a => ({ ...a, city_id: a.city_id || res.cities[0]?.id || '' }))
      setChapter(c => ({ ...c, area_id: c.area_id || res.areas[0]?.id || '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat master data.')
    }
  }

  useEffect(() => { void load() }, [])

  const submit = async (event: FormEvent, path: string, body: unknown, reset: () => void) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post(path, body)
      reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  const toggleChapter = async (c: Chapter) => {
    try {
      await api.patch(`/master/chapters/${c.id}/active`, { is_active: !c.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status chapter.')
    }
  }

  if (error && !data) return <div className="alert">{error}</div>
  if (!data) return <p className="muted">Memuat…</p>

  return (
    <>
      <h1>Master Wilayah</h1>
      <p className="muted small breadcrumb">
        Struktur tenant:
        {['Organisasi', 'Kota', 'Area', 'Chapter'].map((level, i) => (
          <span key={level}>
            {i > 0 && <Icon name="chevron-right" size={0.8} />}
            {level}
          </span>
        ))}
      </p>
      {error && <div className="alert">{error}</div>}

      <section className="card">
        <h2>Tambah Kota</h2>
        <form className="form-grid" onSubmit={e => submit(e, '/master/cities', city, () => setCity({ ...city, name: '' }))}>
          <div>
            <label htmlFor="c-org">Organisasi</label>
            <select id="c-org" value={city.organization_id} onChange={e => setCity({ ...city, organization_id: e.target.value })}>
              {data.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="c-name">Nama Kota</label>
            <input id="c-name" value={city.name} required onChange={e => setCity({ ...city, name: e.target.value })} />
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary" disabled={busy}>Tambah</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Tambah Area</h2>
        <form className="form-grid" onSubmit={e => submit(e, '/master/areas', area, () => setArea({ ...area, name: '' }))}>
          <div>
            <label htmlFor="a-city">Kota</label>
            <select id="a-city" value={area.city_id} onChange={e => setArea({ ...area, city_id: e.target.value })}>
              {data.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-name">Nama Area</label>
            <input id="a-name" value={area.name} required onChange={e => setArea({ ...area, name: e.target.value })} />
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary" disabled={busy}>Tambah</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Tambah Chapter</h2>
        <form className="form-grid" onSubmit={e => submit(e, '/master/chapters', chapter, () => setChapter({ ...chapter, name: '', display_name: '' }))}>
          <div>
            <label htmlFor="ch-area">Area</label>
            <select id="ch-area" value={chapter.area_id} onChange={e => setChapter({ ...chapter, area_id: e.target.value })}>
              {data.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ch-name">Nama</label>
            <input id="ch-name" value={chapter.name} required placeholder="BNI Bloom"
                   onChange={e => setChapter({ ...chapter, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ch-display">Nama Tampilan</label>
            <input id="ch-display" value={chapter.display_name} placeholder="otomatis: <nama> Chapter"
                   onChange={e => setChapter({ ...chapter, display_name: e.target.value })} />
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary" disabled={busy}>Tambah</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Chapter &amp; Domain</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Chapter</th><th>Area</th><th>Domain</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.chapters.map(c => {
                const areaName = data.areas.find(a => a.id === c.area_id)?.name ?? '—'
                const domains = data.domains.filter(d => d.chapter_id === c.id)
                return (
                  <tr key={c.id}>
                    <td><strong>{c.display_name}</strong><div className="muted small">{c.name}</div></td>
                    <td>{areaName}</td>
                    <td>
                      {domains.length === 0 ? <span className="muted">—</span> : domains.map(d => (
                        <div key={d.id}>
                          <code>{d.domain}</code>
                          {d.is_primary && <span className="pill"> utama</span>}
                        </div>
                      ))}
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => void toggleChapter(c)}>
                        {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
