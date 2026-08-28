import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './auth'
import Login from './pages/Login'
import Visitors from './pages/Visitors'
import './styles.css'

function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center muted">Memuat…</div>
  return user ? <Visitors /> : <Login />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
