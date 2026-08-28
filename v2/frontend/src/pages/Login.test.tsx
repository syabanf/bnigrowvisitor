import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Login from './Login'

const login = vi.fn()

vi.mock('../auth', () => ({
  useAuth: () => ({ login, user: null, loading: false, logout: vi.fn() }),
}))

function mockTenant(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, headers: new Headers(), json: async () => payload,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  login.mockReset()
})

describe('Login', () => {
  it('shows the neutral name when the host matches no chapter', async () => {
    mockTenant({ matched: false })
    render(<Login />)
    expect(await screen.findByRole('heading', { name: 'BNI Visitor' })).toBeInTheDocument()
  })

  it('shows the chapter branding when the host resolves to one', async () => {
    mockTenant({
      matched: true,
      display_name: 'BNI Grow Chapter',
      chapter: { name: 'BNI Grow', city_name: 'Jakarta' },
    })
    render(<Login />)
    // Branding has to appear before any session exists, or every tenant sees
    // the same generic login page.
    expect(await screen.findByRole('heading', { name: 'BNI Grow Chapter' })).toBeInTheDocument()
    expect(screen.getByText(/Jakarta/)).toBeInTheDocument()
  })

  it('offers a one-click button per demo account', async () => {
    mockTenant({ matched: false })
    render(<Login />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /National Admin/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /PIC/ })).toBeInTheDocument()
    })
  })

  it('signs in with the demo password when a role button is pressed', async () => {
    mockTenant({ matched: false })
    login.mockResolvedValue(undefined)
    render(<Login />)

    const button = await screen.findByRole('button', { name: /National Admin/ })
    button.click()

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('national@demo.test', 'demo123')
    })
  })

  it('surfaces the server message when signing in fails', async () => {
    mockTenant({ matched: false })
    login.mockRejectedValue(new Error('email atau password salah'))
    render(<Login />)

    const button = await screen.findByRole('button', { name: /Chapter Admin — BNI Grow/ })
    button.click()

    expect(await screen.findByText('email atau password salah')).toBeInTheDocument()
  })
})
