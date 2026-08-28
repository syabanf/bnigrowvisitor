import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import QuickTour from './tour/QuickTour'
import Login from './pages/Login'
import Confirm from './pages/Confirm'
import { registerServiceWorker } from './pwa'
import './styles.css'

// Every authenticated screen is its own chunk. Before this the entry bundle
// carried all of them, so opening the login page downloaded the kanban board
// and Master Wilayah too.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Visitors = lazy(() => import('./pages/Visitors'))
const Members = lazy(() => import('./pages/Members'))
const Guests = lazy(() => import('./pages/Guests'))
const Accounts = lazy(() => import('./pages/Accounts'))
const National = lazy(() => import('./pages/National'))
const MCQA = lazy(() => import('./pages/MCQA'))
const Meetings = lazy(() => import('./pages/Meetings'))
const WaBlast = lazy(() => import('./pages/WaBlast'))
const Transfer = lazy(() => import('./pages/Transfer'))
const Activity = lazy(() => import('./pages/Activity'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const MyAccount = lazy(() => import('./pages/MyAccount'))
const Master = lazy(() => import('./pages/Master'))
const Policies = lazy(() => import('./pages/Policies'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const Governance = lazy(() => import('./pages/Governance'))
const TextFormat = lazy(() => import('./pages/TextFormat'))

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
    <>
      <QuickTour />
      <Suspense fallback={<div className="center muted route-loading">Memuat…</div>}>
        <Routes>
        <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="visitors" element={<Visitors />} />
        <Route path="mcqa" element={<MCQA />} />
        <Route path="members" element={<Members />} />
        <Route path="guests" element={<Guests />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="wa-blast" element={<WaBlast />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="activity" element={<Activity />} />
        <Route path="text-format" element={<TextFormat />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="my-account" element={<MyAccount />} />
        {/* Guarded in the router too, not just hidden from the nav — the API
            refuses it either way, but a stray URL should not render a broken
            page. */}
        <Route path="national" element={isNational ? <National /> : <Navigate to="/" replace />} />
        <Route path="master" element={isNational ? <Master /> : <Navigate to="/" replace />} />
        <Route path="policies" element={isNational ? <Policies /> : <Navigate to="/" replace />} />
        <Route path="governance" element={isNational ? <Governance /> : <Navigate to="/" replace />} />
        <Route path="api-keys" element={isNational ? <ApiKeys /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
        </Routes>
      </Suspense>
    </>
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
