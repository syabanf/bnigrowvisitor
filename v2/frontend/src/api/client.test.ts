import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('returns the parsed payload on success', async () => {
    mockFetch(200, { data: [{ id: '1' }], total: 1 })
    const result = await api.get<{ total: number }>('/visitors')
    expect(result.total).toBe(1)
  })

  it('always sends the session cookie', async () => {
    const fetchMock = mockFetch(200, {})
    await api.get('/visitors')
    // The session lives in an HttpOnly cookie, so omitting credentials would
    // silently sign every request out.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' })
  })

  it('prefixes the path with /api', async () => {
    const fetchMock = mockFetch(200, {})
    await api.get('/members')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/members')
  })

  it('raises ApiError carrying the server message and status', async () => {
    mockFetch(403, { error: 'tidak punya akses' })
    await expect(api.get('/visitors')).rejects.toThrowError(
      expect.objectContaining({ message: 'tidak punya akses', status: 403 }),
    )
  })

  it('falls back to a generic message when the body has no error field', async () => {
    mockFetch(500, {})
    await expect(api.get('/visitors')).rejects.toThrowError(ApiError)
  })

  it('sets the JSON content type only when there is a body', async () => {
    const fetchMock = mockFetch(200, {})
    await api.post('/visitors', { name: 'Budi' })
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'Content-Type': 'application/json',
    })

    vi.unstubAllGlobals()
    const noBody = mockFetch(200, {})
    await api.post('/auth/logout')
    expect(noBody.mock.calls[0][1].headers).toEqual({})
  })

  it('serialises the body as JSON', async () => {
    const fetchMock = mockFetch(200, {})
    await api.patch('/visitors/1', { status: 'confirmed' })
    expect(fetchMock.mock.calls[0][1].body).toBe('{"status":"confirmed"}')
  })
})
