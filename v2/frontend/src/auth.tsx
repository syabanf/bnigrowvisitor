import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from './api/client'
import type { User } from './api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The session lives in an HttpOnly cookie the client cannot read, so identity
  // is re-established by asking the server rather than reading local storage.
  useEffect(() => {
    api
      .get<{ user: User }>('/auth/me')
      .then(res => setUser(res.user))
      .catch(err => {
        // A 401 here is the normal "not signed in" case, not a failure.
        if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/login', { email, password })
    setUser(res.user)
  }

  const logout = async () => {
    await api.post('/auth/logout')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
