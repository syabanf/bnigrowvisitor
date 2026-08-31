import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { STATUS_LABEL } from '../api/types'
import Icon from './Icon'
import { useMeetingOptions, usePICOptions } from '../hooks/useOptions'
import { formatDate } from '../lib/format'

interface PriorVisit {
  id: string; name: string; chapter_name: string; status: string; created_at: string
}

interface Frequency {
  count: number
  limit: number
  period_months: number
  exceeded: boolean
  visits: PriorVisit[]
}

const EMPTY = {
  name: '', phone: '', email: '', business_field: '', company: '',
  gender: '', referral_name: '', meeting_id: '', pic_id: '', status: 'new', notes: '',
}

/**
 * Adding a visitor — the thing this app is named after, and the one action its
 * screens had no way to perform.
 *
 * The phone is checked against the visitor-frequency policy as it is typed. That
 * policy has been stored and shown on the policies screen since it was built and
 * never once applied, so someone on their fourth visit under a three-visit limit
 * was recorded without a word.
 */
export default function AddVisitorForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [freq, setFreq] = useState<Frequency | null>(null)
  const meetings = useMeetingOptions()
  const pics = usePICOptions()

  const set = (key: keyof typeof EMPTY, value: string) => setForm(f => ({ ...f, [key]: value }))

  // Debounced, and only once the number is long enough to identify anyone —
  // checking every keystroke would ask the database about "08", "081", "0812".
  useEffect(() => {
    const digits = form.phone.replace(/[^0-9]/g, '')
    if (!open || digits.length < 9) { setFreq(null); return }
    const timer = setTimeout(() => {
      api.get<Frequency>(`/visitor-frequency?phone=${encodeURIComponent(form.phone)}`)
        .then(setFreq)
        // A failed check must not block the form: it is a warning, not a gate.
        .catch(() => setFreq(null))
    }, 400)
    return () => clearTimeout(timer)
  }, [form.phone, open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      // Empty selects are sent as null, not "": the column is a uuid, and an
      // empty string is not one.
      await api.post('/visitors', {
        ...form,
        meeting_id: form.meeting_id || null,
        pic_id: form.pic_id || null,
      })
      setForm(EMPTY)
      setFreq(null)
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan visitor.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Tambah Visitor
      </button>
    )
  }

  return (
    <section className="card form-card">
      <div className="card__head">
        <h2>Tambah Visitor</h2>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => setOpen(false)}>
          <Icon name="close" label="Tutup form" />
        </button>
      </div>

      {error && <div className="alert"><Icon name="alert" size={0.95} /> <span>{error}</span></div>}

      {freq && freq.count > 0 && (
        <div className={`alert${freq.exceeded ? '' : ' alert--ok'}`}>
          <Icon name={freq.exceeded ? 'alert' : 'clock'} size={0.95} />
          <span>
            <strong>
              {freq.exceeded
                ? `Sudah ${freq.count} kali berkunjung — melewati batas ${freq.limit}.`
                : `Pernah berkunjung ${freq.count} dari ${freq.limit} kali.`}
            </strong>{' '}
            Dalam {freq.period_months} bulan terakhir, lintas chapter.
            <ul className="freq-list">
              {freq.visits.slice(0, 3).map(v => (
                <li key={v.id}>{v.chapter_name} · {formatDate(v.created_at)}</li>
              ))}
            </ul>
          </span>
        </div>
      )}

      <form onSubmit={submit} className="form-grid">
        <div>
          <label htmlFor="v-name">Nama *</label>
          <input id="v-name" value={form.name} required onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-phone">Telepon *</label>
          <input id="v-phone" value={form.phone} required placeholder="0812…"
                 onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-email">Email</label>
          <input id="v-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-company">Perusahaan</label>
          <input id="v-company" value={form.company} onChange={e => set('company', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-field">Bidang Usaha</label>
          <input id="v-field" value={form.business_field} onChange={e => set('business_field', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-ref">Diajak Oleh</label>
          <input id="v-ref" value={form.referral_name} onChange={e => set('referral_name', e.target.value)} />
        </div>
        <div>
          <label htmlFor="v-meeting">Meeting</label>
          <select id="v-meeting" value={form.meeting_id} onChange={e => set('meeting_id', e.target.value)}>
            <option value="">Belum ditentukan</option>
            {meetings.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="v-pic">PIC</label>
          <select id="v-pic" value={form.pic_id} onChange={e => set('pic_id', e.target.value)}>
            <option value="">Belum ada</option>
            {pics.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="v-status">Status</label>
          <select id="v-status" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l as string}</option>
            ))}
          </select>
        </div>
        <div className="form-grid__action">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan Visitor'}
          </button>
        </div>
      </form>
    </section>
  )
}
