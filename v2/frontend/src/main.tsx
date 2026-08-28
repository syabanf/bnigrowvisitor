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
import './styles.css'

function App() {
  const { user, loading } = useAuth()

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
        <Route path="members" element={<Members />} />
        <Route path="guests" element={<Guests />} />
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
