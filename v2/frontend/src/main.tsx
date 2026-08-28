import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Visitors from './pages/Visitors'
import Members from './pages/Members'
import Guests from './pages/Guests'
import Accounts from './pages/Accounts'
import National from './pages/National'
import MCQA from './pages/MCQA'
import Meetings from './pages/Meetings'
import WaBlast from './pages/WaBlast'
import Transfer from './pages/Transfer'
import Activity from './pages/Activity'
import Confirm from './pages/Confirm'
import { registerServiceWorker } from './pwa'
import './styles.css'

function App() {
  const { user, loading } = useAuth()

  // The confirmation link is opened by a visitor who has no account, so it is
  // matched before the auth gate — routing it through the login screen would
  // make the WhatsApp link useless.
  const confirmToken = window.location.pathname.match(/^\/wm\/([^/]+)/)?.[1]
  if (confirmToken) return <Confirm token={decodeURIComponent(confirmToken)} />

  // Nothing renders until the session check resolves; routing on a null user
  // first would flash the login screen at someone who is already signed in.
  if (loading) return <div className="center muted">Memuat…</div>
  if (!user) return <Login />

  const isNational = user.role === 'national_admin' || user.role === 'admin'

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="visitors" element={<Visitors />} />
        <Route path="mcqa" element={<MCQA />} />
        <Route path="members" element={<Members />} />
        <Route path="guests" element={<Guests />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="wa-blast" element={<WaBlast />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="activity" element={<Activity />} />
        <Route path="accounts" element={<Accounts />} />
        {/* Guarded in the router too, not just hidden from the nav — the API
            refuses it either way, but a stray URL should not render a broken
            page. */}
        <Route path="national" element={isNational ? <National /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
