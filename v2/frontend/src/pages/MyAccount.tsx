import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import PageHeader from '../components/PageHeader'

export default function MyAccount() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')

    // Checked here as well as on the server: catching a mismatch before the
    // request saves a round trip and keeps the message specific.
    if (next !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setBusy(true)
    try {
      await api.post('/account/change-password', {
        current_password: current, new_password: next,
      })
      setNotice('Password berhasil diubah.')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Profil Saya"
      />

      <section className="card">
        <h2>Identitas</h2>
        <dl className="kv">
          <dt>Nama</dt><dd>{user?.name}</dd>
          <dt>Email</dt><dd>{user?.email}</dd>
          <dt>Peran</dt><dd>{user?.role}</dd>
          <dt>Chapter</dt><dd>{user?.chapter_name ?? 'Semua chapter'}</dd>
          {user?.city_name && <><dt>Kota</dt><dd>{user.city_name}</dd></>}
        </dl>
      </section>

      <section className="card">
        <h2>Ubah Password</h2>
        {error && <div className="alert">{error}</div>}
        {notice && <div className="alert alert--ok">{notice}</div>}

        <form onSubmit={submit} className="form-grid">
          <div>
            <label htmlFor="cur">Password Sekarang</label>
            <input id="cur" type="password" value={current} required autoComplete="current-password"
                   onChange={e => setCurrent(e.target.value)} />
          </div>
          <div>
            <label htmlFor="new">Password Baru</label>
            <input id="new" type="password" value={next} required minLength={10} autoComplete="new-password"
                   onChange={e => setNext(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cnf">Ulangi Password Baru</label>
            <input id="cnf" type="password" value={confirm} required minLength={10} autoComplete="new-password"
                   onChange={e => setConfirm(e.target.value)} />
          </div>
          <div className="form-grid__action">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
        <p className="muted small">
          Minimal 10 karakter. Password sekarang wajib diisi — sesi yang dicuri saja
          tidak boleh cukup untuk mengunci pemilik aslinya.
        </p>
      </section>
    </>
  )
}
