import { useEffect, useState } from 'react'
import { api } from '../api/client'

export interface Option {
  id: string
  label: string
}

interface Meeting { id: string; title: string; meeting_date: string }
interface PIC { id: string; name: string }

/**
 * The lists that fill the filter dropdowns.
 *
 * Fetched once per mount rather than per keystroke: these change on the scale of
 * weeks, and re-requesting them alongside every search would triple the traffic
 * of typing a name.
 *
 * A failure is silent and leaves the list empty, which hides that filter rather
 * than breaking the page — the screen's own data is what someone came for.
 */
export function useMeetingOptions(): Option[] {
  const [options, setOptions] = useState<Option[]>([])
  useEffect(() => {
    let cancelled = false
    api.get<{ data: Meeting[] }>('/meetings?limit=200')
      .then(res => {
        if (cancelled) return
        setOptions(res.data.map(m => ({
          id: m.id,
          // The date disambiguates: a chapter meets weekly, so a dozen entries
          // share the title "Weekly Meeting BNI Grow".
          label: `${m.title} · ${new Date(m.meeting_date).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}`,
        })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return options
}

export function usePICOptions(): Option[] {
  const [options, setOptions] = useState<Option[]>([])
  useEffect(() => {
    let cancelled = false
    api.get<{ data: PIC[] }>('/pics')
      .then(res => { if (!cancelled) setOptions(res.data.map(p => ({ id: p.id, label: p.name }))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return options
}
