import { useEffect, useState } from 'react'
import Icon from '../components/Icon'

interface ConfirmResult {
  status: 'confirmed' | 'already'
  name?: string
  meeting?: string
}

/**
 * The page a visitor lands on from a WhatsApp link. It runs before any session
 * exists and must not require one — so it lives outside the authenticated shell
 * entirely.
 */
export default function Confirm({ token }: { token: string }) {
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/public/confirm/${encodeURIComponent(token)}`, { method: 'POST' })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? 'Link tidak dikenali.')
        setResult(payload as ConfirmResult)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Link tidak dikenali.'))
  }, [token])

  return (
    <div className="login">
      <div className="login__card center">
        {error ? (
          <>
            <div className="confirm__icon confirm__icon--bad"><Icon name="alert" size={1.6} /></div>
            <h1>Link tidak dikenali</h1>
            <p className="muted">
              Link konfirmasi ini tidak valid atau sudah tidak berlaku. Hubungi PIC yang
              mengundang kamu ya.
            </p>
          </>
        ) : !result ? (
          <p className="muted">Memproses…</p>
        ) : (
          <>
            <div className="confirm__icon"><Icon name="check" size={1.6} /></div>
            <h1>{result.status === 'confirmed' ? 'Terima kasih!' : 'Sudah tercatat'}</h1>
            <p className="muted">
              {result.status === 'confirmed'
                ? 'Kehadiran kamu sudah kami catat.'
                : 'Kehadiran kamu sudah tercatat sebelumnya.'}
            </p>
            {result.name && <p><strong>{result.name}</strong></p>}
            {result.meeting && <p className="muted small">{result.meeting}</p>}
          </>
        )}
      </div>
    </div>
  )
}
