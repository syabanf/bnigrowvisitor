import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

type ListResponse<T, E> = {
  data: T[]
  total: number
} & Partial<E>

const DEFAULT_PAGE_SIZE = 50

/**
 * Shared list-fetching for the resource pages: server-side filtering, server-side
 * paging, debounced so typing in a search box does not fire a request per
 * keystroke, and cancelled on unmount so a slow reply cannot land on a view the
 * user has already left.
 *
 * Paging is deliberately not done in the browser. The API caps a page at 200
 * rows, so a client-side filter would be searching whatever slice happened to
 * arrive first — a visitor on row 300 would simply not exist as far as the
 * search box was concerned, with nothing on screen to say so.
 */
export function useResource<T, E = Record<string, never>>(
  path: string,
  params: Record<string, string>,
) {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  // Aggregates a list endpoint returns alongside its page — counts that have to
  // be computed over the whole set, not the rows that happen to be on screen.
  const [extra, setExtra] = useState<Partial<E>>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const filters = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== ''),
  ).toString()

  // Narrowing the filter usually shrinks the result below the current offset,
  // and an empty page-9 with no explanation reads as "no data" rather than "you
  // are past the end". Snapping back to the first page is what the user means
  // by changing a filter anyway.
  const lastFilters = useRef(filters)
  if (lastFilters.current !== filters) {
    lastFilters.current = filters
    if (page !== 1) setPage(1)
  }

  const query = new URLSearchParams(filters)
  query.set('limit', String(pageSize))
  query.set('offset', String((page - 1) * pageSize))

  const url = `${path}?${query.toString()}`

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<ListResponse<T, E>>(url)
      const { data, total: count, ...rest } = res
      setItems(data ?? [])
      setTotal(count ?? 0)
      setExtra(rest as Partial<E>)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [url])

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

  const changePageSize = useCallback((size: number) => {
    setPageSize(size)
    // Row 400 is on page 8 at 50 per page and page 2 at 200; keeping the page
    // number would jump the user somewhere they did not ask to go.
    setPage(1)
  }, [])

  return {
    items, total, extra, loading, error, reload: load, setError,
    page, setPage, pageSize, setPageSize: changePageSize,
  }
}
