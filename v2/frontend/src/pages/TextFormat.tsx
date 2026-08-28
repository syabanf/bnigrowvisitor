import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'

interface Template {
  id: string
  name: string
  body: string
  is_default: boolean
}

const PLACEHOLDERS = ['nama', 'chapter', 'meeting', 'tanggal', 'pic', 'perusahaan', 'link_hadir']

export default function TextFormat() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [drafts, setDrafts] = useState<Record<string, Template>>({})
  const [creating, setCreating] = useState({ name: '', body: '', is_default: false })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    try {
      const res = await api.get<{ data: Template[] }>('/wa/templates')
      setTemplates(res.data)
      setDrafts(Object.fromEntries(res.data.map(t => [t.id, { ...t }])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat template.')
    }
  }

  useEffect(() => { void load() }, [])

  const save = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    setError(''); setNotice('')
    try {
      await api.patch(`/wa/templates/${id}`, {
        name: draft.name, body: draft.body, is_default: draft.is_default,
      })
      setNotice(`Template "${draft.name}" tersimpan.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan template.')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.delete(`/wa/templates/${id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus template.')
    }
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setNotice('')
    try {
      await api.post('/wa/templates', creating)
      setCreating({ name: '', body: '', is_default: false })
      setNotice('Template dibuat.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat template.')
    }
  }

  return (
    <>
      <h1>Text Format</h1>
      <p className="muted small">
        Template pesan WhatsApp. Placeholder yang tidak dikenal sengaja dibiarkan terlihat
        saat dirender — {'{salah_ketik}'} yang muncul di pratinjau memberi tahu kamu,
        string kosong menyembunyikannya sampai pesan telanjur terkirim.
      </p>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="alert alert--ok">{notice}</div>}

      <section className="card">
        <h2>Placeholder Tersedia</h2>
        <div className="row-gap">
          {PLACEHOLDERS.map(p => <code key={p}>{`{${p}}`}</code>)}
        </div>
      </section>

      {templates.map(t => {
        const draft = drafts[t.id]
        if (!draft) return null
        return (
          <section key={t.id} className="card">
            <div className="form-grid">
              <div>
                <label htmlFor={`n-${t.id}`}>Nama</label>
                <input id={`n-${t.id}`} value={draft.name}
                       onChange={e => setDrafts({ ...drafts, [t.id]: { ...draft, name: e.target.value } })} />
              </div>
              <div>
                <label htmlFor={`d-${t.id}`}>Default</label>
                <select id={`d-${t.id}`} value={draft.is_default ? '1' : '0'}
                        onChange={e => setDrafts({ ...drafts, [t.id]: { ...draft, is_default: e.target.value === '1' } })}>
                  <option value="0">Bukan default</option>
                  <option value="1">Default</option>
                </select>
              </div>
            </div>

            <label htmlFor={`b-${t.id}`}>Isi Pesan</label>
            <textarea id={`b-${t.id}`} className="code-area" rows={5} value={draft.body}
                      onChange={e => setDrafts({ ...drafts, [t.id]: { ...draft, body: e.target.value } })} />

            <div className="row-end">
              <button className="btn btn--small" onClick={() => void remove(t.id)}>Hapus</button>
              <button className="btn btn--primary btn--small" onClick={() => void save(t.id)}>Simpan</button>
            </div>
          </section>
        )
      })}

      <section className="card">
        <h2>Template Baru</h2>
        <form onSubmit={create}>
          <label htmlFor="new-name">Nama</label>
          <input id="new-name" value={creating.name} required
                 onChange={e => setCreating({ ...creating, name: e.target.value })} />
          <label htmlFor="new-body">Isi Pesan</label>
          <textarea id="new-body" className="code-area" rows={4} value={creating.body} required
                    placeholder="Halo {nama}, konfirmasi kehadiran di {link_hadir}"
                    onChange={e => setCreating({ ...creating, body: e.target.value })} />
          <div className="row-end">
            <button className="btn btn--primary btn--small">Buat</button>
          </div>
        </form>
      </section>
    </>
  )
}
