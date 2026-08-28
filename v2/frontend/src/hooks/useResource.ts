import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

interface ListResponse<T> {
  data: T[]
  total: number
}

/**
 * Shared list-fetching for the resource pages. Debounced so typing in a search
 * box does not fire a request per keystroke, and cancelled on unmount so a slow
 * reply cannot land on a view the user has already left.
 */
export function useResource<T>(path: string, params: Record<string, string>) {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== ''),
  ).toString()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<ListResponse<T>>(`${path}${query ? `?${query}` : ''}`)
      setItems(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [path, query])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) void load()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [load])

  return { items, total, loading, error, reload: load, setError }
}
