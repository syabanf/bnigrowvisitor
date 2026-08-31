import { useRef, useState } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'

interface ImportError {
  row: number
  name?: string
  reason: string
}

interface ImportResult {
  imported: number
  skipped: number
  errors: ImportError[]
}

export default function Transfer() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<'csv' | 'xlsx' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // A plain link would send the request without the session cookie in some
  // configurations and cannot surface an error; fetching keeps both.
  const download = async (format: 'csv' | 'xlsx') => {
    setError('')
    setDownloading(format)
    try {
      const response = await fetch(`/api/export/visitors?format=${format}`, {
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error('Gagal mengunduh.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `visitors-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh.')
    } finally {
      setDownloading(null)
    }
  }

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setBusy(true)
    setError('')
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/import/visitors', {
        method: 'POST', credentials: 'same-origin', body,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? 'Import gagal.')
      setResult(payload as ImportResult)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Export / Import"
      />
      {error && <div className="alert">{error}</div>}

      <section className="card">
        <h2>Export Visitor</h2>
        <p className="muted small">
          Unduh seluruh visitor chapter ini. CSV berformat UTF-8 dengan BOM, jadi Excel
          membukanya tanpa merusak huruf beraksen; <code>.xlsx</code> membukanya langsung
          sebagai workbook. Kolomnya sama persis, jadi hasil unduhan bisa diimpor kembali
          apa adanya.
        </p>
        <div className="btn-row">
          <button
            className="btn btn--primary" disabled={downloading !== null}
            onClick={() => void download('xlsx')}
          >
            <Icon name="download" /> {downloading === 'xlsx' ? 'Menyiapkan…' : 'Unduh Excel'}
          </button>
          <button
            className="btn" disabled={downloading !== null}
            onClick={() => void download('csv')}
          >
            <Icon name="download" /> {downloading === 'csv' ? 'Menyiapkan…' : 'Unduh CSV'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Import Visitor</h2>
        <p className="muted small">
          Kolom yang dibaca: <code>nama</code>, <code>telepon</code>, <code>email</code>,{' '}
          <code>bidang_usaha</code>, <code>perusahaan</code>, <code>gender</code>,{' '}
          <code>diajak_oleh</code>, <code>status</code>, <code>catatan</code>. Hanya{' '}
          <code>nama</code> dan <code>telepon</code> yang wajib. Format dikenali dari isi
          file, bukan dari ekstensinya — file Excel yang terlanjur dinamai <code>.csv</code>
          tetap terbaca.
        </p>
        <div className="form-grid">
          <div>
            <label htmlFor="imp">File CSV atau Excel</label>
            <input
              id="imp" ref={fileRef} type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary" onClick={() => void upload()} disabled={busy}>
              {busy ? 'Mengimpor…' : 'Import'}
            </button>
          </div>
        </div>

        {result && (
          <div className={result.skipped > 0 ? 'alert' : 'alert alert--ok'}>
            <strong>{result.imported} baris masuk</strong>
            {result.skipped > 0 && <> · {result.skipped} dilewati</>}
            {result.errors.length > 0 && (
              // Named, not just counted: "37 dari 40 masuk" without saying which
              // three is useless to whoever has to fix the file.
              <ul className="errlist">
                {result.errors.map(e => (
                  <li key={e.row}>
                    Baris {e.row}{e.name ? ` (${e.name})` : ''}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  )
}
