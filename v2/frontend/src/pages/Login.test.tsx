import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Login from './Login'

const login = vi.fn()

vi.mock('../auth', () => ({
  useAuth: () => ({ login, user: null, loading: false, logout: vi.fn() }),
}))

const DEMO_ACCOUNTS = {
  password: 'demo123',
  accounts: [
    { email: 'national@demo.test', name: 'Rina Wijaya', role: 'national_admin',
      label: 'National Admin', scope: 'Semua chapter' },
    { email: 'grow@demo.test', name: 'Budi Santoso', role: 'chapter_admin',
      label: 'Chapter Admin', scope: 'BNI Grow' },
    { email: 'pic1.grow@demo.test', name: 'Reza Nugroho', role: 'pic',
      label: 'PIC', scope: 'BNI Grow' },
  ],
}

// The login screen makes two calls, and they must be answered separately: a
// single blanket mock returned the tenant payload for the demo-accounts request
// too, and the component then read .accounts off an object that did not have it.
function mockApi(tenant: unknown, demo: unknown = DEMO_ACCOUNTS) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const body = String(url).includes('/demo-accounts') ? demo : tenant
    return Promise.resolve({
      ok: body !== null,
      status: body === null ? 404 : 200,
      headers: new Headers(),
      json: async () => body,
    })
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  login.mockReset()
})

describe('Login', () => {
  it('shows the neutral name when the host matches no chapter', async () => {
    mockApi({ matched: false })
    render(<Login />)
    expect(await screen.findByRole('heading', { name: 'BNI Visitor' })).toBeInTheDocument()
  })

  it('shows the chapter branding when the host resolves to one', async () => {
    mockApi({
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

  it('offers a one-click button per demo account the server lists', async () => {
    mockApi({ matched: false })
    render(<Login />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /National Admin/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reza Nugroho.*PIC/ })).toBeInTheDocument()
    })
  })

  // Demo mode off is the normal answer in a real deployment, and the panel
  // simply must not appear — a login screen advertising working credentials is
  // the failure this guards against.
  it('shows no quick sign-in when the server does not offer it', async () => {
    mockApi({ matched: false }, null)
    render(<Login />)
    expect(await screen.findByRole('heading', { name: 'BNI Visitor' })).toBeInTheDocument()
    expect(screen.queryByText('Masuk Cepat')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /National Admin/ })).not.toBeInTheDocument()
  })

  // A malformed body must not take the whole login screen down with it: the
  // password form is the part that has to keep working.
  it('still renders the sign-in form if the account list is malformed', async () => {
    mockApi({ matched: false }, { unexpected: true })
    render(<Login />)
    // Matched on the submit button's accessible name, which now includes the
    // icon-free label only — the button reads "Masuk" since the redesign.
    expect(await screen.findByRole('button', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('signs in with the demo password when a role button is pressed', async () => {
    mockApi({ matched: false })
    login.mockResolvedValue(undefined)
    render(<Login />)

    const button = await screen.findByRole('button', { name: /National Admin/ })
    button.click()

    await waitFor(() => {
      // The password comes from the server response, not from a constant in
      // the page — the two can no longer disagree.
      expect(login).toHaveBeenCalledWith('national@demo.test', 'demo123')
    })
  })

  it('surfaces the server message when signing in fails', async () => {
    mockApi({ matched: false })
    login.mockRejectedValue(new Error('email atau password salah'))
    render(<Login />)

    const button = await screen.findByRole('button', { name: /Budi Santoso.*Chapter Admin.*BNI Grow/ })
    button.click()

    expect(await screen.findByText('email atau password salah')).toBeInTheDocument()
  })
})
