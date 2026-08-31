import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { STATUS_LABEL } from '../api/types'
import PageHeader from '../components/PageHeader'

interface Template {
  id: string
  name: string
  body: string
  is_default: boolean
}

interface BlastMessage {
  visitor_id: string
  name: string
  phone: string
  message: string
  whatsapp_url: string
  skipped?: string
}

export default function WaBlast() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState('')
  const [status, setStatus] = useState('')
  const [messages, setMessages] = useState<BlastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<{ data: Template[] }>('/wa/templates')
      .then(res => {
        setTemplates(res.data)
        const preferred = res.data.find(t => t.is_default) ?? res.data[0]
        if (preferred) setTemplateId(preferred.id)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat template.'))
  }, [])

  const build = async () => {
    if (!templateId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ templateId })
      if (status) params.set('status', status)
      const res = await api.get<{ data: BlastMessage[] }>(`/wa/blast?${params}`)
      setMessages(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyiapkan pesan.')
    } finally {
      setLoading(false)
    }
  }

  const selected = templates.find(t => t.id === templateId)
  const sendable = messages.filter(m => !m.skipped)
  const skipped = messages.filter(m => m.skipped)

  return (
    <>
      <PageHeader
        title="WA Blast"
        subtitle={<>Pesan disiapkan di sini, lalu <strong>kamu</strong> yang menekan kirim. Aplikasi ini sengaja tidak mengirim otomatis — gateway WhatsApp tidak resmi adalah cara tercepat nomor chapter diblokir.</>}
      />

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <div className="form-grid">
          <div>
            <label htmlFor="wa-tpl">Template</label>
            <select id="wa-tpl" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wa-status">Filter Status</label>
            <select id="wa-status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary" onClick={() => void build()} disabled={loading || !templateId}>
              {loading ? 'Menyiapkan…' : 'Siapkan Pesan'}
            </button>
          </div>
        </div>

        {selected && (
          <>
            <label>Isi Template</label>
            <pre className="preview">{selected.body}</pre>
            <p className="muted small">
              Placeholder tersedia: {'{nama}'} {'{chapter}'} {'{meeting}'} {'{tanggal}'} {'{pic}'} {'{perusahaan}'} {'{link_hadir}'}
            </p>
          </>
        )}
      </section>

      {messages.length > 0 && (
        <>
          <p className="muted small">
            {sendable.length} siap dikirim
            {skipped.length > 0 && ` · ${skipped.length} dilewati`}
          </p>

          {skipped.length > 0 && (
            <div className="alert">
              Dilewati: {skipped.map(m => `${m.name} (${m.skipped})`).join(', ')}
            </div>
          )}

          <div className="msg-list">
            {sendable.map(m => (
              <div key={m.visitor_id} className="msg">
                <div className="msg__head">
                  <strong>{m.name}</strong>
                  <span className="muted small">{m.phone}</span>
                  <a className="btn btn--small" href={m.whatsapp_url} target="_blank" rel="noopener noreferrer">
                    Buka WhatsApp
                  </a>
                </div>
                <pre className="preview">{m.message}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
