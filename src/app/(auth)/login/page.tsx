'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword, signIn, verifyOldPassword } from '@/lib/auth'
import { isNationalAdmin } from '@/lib/permissions'
import { getChapterRoute } from '@/lib/chapterRoute'

interface LoginBranding {
  name: string
  displayName: string
  cityName: string
}

const DEFAULT_BRANDING: LoginBranding = { name: 'BNI', displayName: 'BNI', cityName: '' }

interface DemoAccount {
  email: string
  name: string
  label: string
  scope: string
}

interface DemoInfo {
  password: string
  accounts: DemoAccount[]
}

export default function LoginPage() {
  const router = useRouter()
  const [branding, setBranding] = useState<LoginBranding>(DEFAULT_BRANDING)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login' | 'change-password'>('login')
  const [oldPassword, setOldPassword] = useState('')
  const [oldPasswordVerified, setOldPasswordVerified] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  // null until we know; stays null on a real deployment, which hides the panel.
  const [demo, setDemo] = useState<DemoInfo | null>(null)
  const [demoPending, setDemoPending] = useState('')

  // Pull branding from the domain's tenant so the login screen reflects the
  // chapter, not a hardcoded one.
  useEffect(() => {
    let cancelled = false
    fetch('/api/tenant-context', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(context => {
        if (cancelled || !context?.chapter) return
        setBranding({
          name: context.chapter.name || context.chapter.display_name || 'BNI',
          displayName: context.chapter.display_name || context.chapter.name || 'BNI',
          cityName: context.city?.name || '',
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/demo', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(info => {
        if (cancelled || !info?.demo) return
        setDemo({ password: info.password, accounts: info.accounts || [] })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Shared by the form and the demo shortcuts so both take the same path.
  const authenticate = async (withEmail: string, withPassword: string) => {
    const result = await signIn(withEmail, withPassword)
    if (result.success && result.user) {
      localStorage.setItem('user', JSON.stringify(result.user))
      router.push(isNationalAdmin(result.user) ? '/national-overview' : getChapterRoute('dashboard', result.user))
      return
    }
    throw new Error(result.error || 'Login gagal. Silakan coba lagi.')
  }

  const handleDemoLogin = async (account: DemoAccount) => {
    if (!demo) return
    setError('')
    setSuccess('')
    setDemoPending(account.email)
    setEmail(account.email)
    setPassword(demo.password)

    try {
      await authenticate(account.email, demo.password)
    } catch (err: any) {
      setError(err.message || 'Login demo gagal.')
    } finally {
      setDemoPending('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await authenticate(email, password)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const resetChangePasswordForm = () => {
    setOldPassword('')
    setOldPasswordVerified(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleVerifyOldPassword = async () => {
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Email wajib diisi.')
      return
    }

    if (!oldPassword.trim()) {
      setError('Password lama wajib diisi.')
      return
    }

    setVerifyLoading(true)
    try {
      const result = await verifyOldPassword(email, oldPassword)

      if (result.success) {
        setOldPasswordVerified(true)
        setSuccess('Password lama valid. Silakan masukkan password baru.')
      } else {
        setOldPasswordVerified(false)
        setError(result.error || 'Password lama salah.')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal validasi password lama.')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!oldPasswordVerified) {
      setError('Validasi password lama terlebih dahulu.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }

    setChangeLoading(true)
    try {
      const result = await changePassword(email, oldPassword, newPassword)

      if (result.success) {
        setSuccess('Password berhasil diubah. Silakan login dengan password baru.')
        setPassword('')
        resetChangePasswordForm()
        setMode('login')
      } else {
        setError(result.error || 'Gagal mengubah password.')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah password.')
    } finally {
      setChangeLoading(false)
    }
  }

  const switchMode = (nextMode: 'login' | 'change-password') => {
    setMode(nextMode)
    setError('')
    setSuccess('')
    resetChangePasswordForm()
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-red-950 via-red-800 to-slate-950">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div>
            <Image
              src="/bni-logo.png"
              alt={`${branding.displayName} Logo`}
              width={160}
              height={64}
              className="object-contain brightness-0 invert"
              priority
            />
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.01em] text-white mb-4">
                Visitor Management System
              </h1>
              <p className="text-xl text-red-100 leading-relaxed tracking-[-0.01em]">
                Kelola kunjungan dan networking {branding.displayName} dengan mudah — dari tracking visitor, manajemen member, hingga laporan meeting real-time.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div>
                <div className="text-3xl font-bold text-white mb-1">1659+</div>
                <div className="text-sm text-red-200">Active Members</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">25+</div>
                <div className="text-sm text-red-200">Chapters</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">6+</div>
                <div className="text-sm text-red-200">Cities</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-red-200">
            © {new Date().getFullYear()} {branding.name}{branding.cityName ? ` ${branding.cityName}` : ''}. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Image
              src="/bni-logo.png"
              alt={`${branding.displayName} Logo`}
              width={120}
              height={48}
              className="mx-auto object-contain"
              priority
            />
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-[-0.01em] text-gray-950 mb-2">
              {mode === 'login' ? 'Selamat Datang' : 'Change Password'}
            </h2>
            <p className="text-gray-600">
              {mode === 'login'
                ? 'Silakan login untuk melanjutkan'
                : 'Validasi password lama sebelum membuat password baru'}
            </p>
          </div>

          {/* Login Card */}
          <div className="glass-panel-strong rounded-[22px] p-8">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                {mode === 'login' ? 'Login Portal' : 'Ubah Password'}
              </h3>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                {success}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleSubmit : handleChangePasswordSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                    placeholder="Masukkan email"
                    required
                    disabled={loading || changeLoading || verifyLoading || oldPasswordVerified}
                  />
                </div>
              </div>

              {mode === 'login' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Password Lama
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value)
                        setOldPasswordVerified(false)
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                      placeholder="Masukkan password lama"
                      required
                      disabled={changeLoading || verifyLoading || oldPasswordVerified}
                    />
                    {!oldPasswordVerified && (
                      <button
                        type="button"
                        onClick={handleVerifyOldPassword}
                        disabled={verifyLoading || changeLoading}
                        className="mt-3 w-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {verifyLoading ? 'Memvalidasi...' : 'Validasi Password Lama'}
                      </button>
                    )}
                  </div>

                  {oldPasswordVerified && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                          Password Baru
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                          placeholder="Minimal 6 karakter"
                          required
                          disabled={changeLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                          Konfirmasi Password Baru
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                          placeholder="Ulangi password baru"
                          required
                          disabled={changeLoading}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || changeLoading || verifyLoading || (mode === 'change-password' && !oldPasswordVerified)}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
              >
                {loading || changeLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Loading...
                  </span>
                ) : mode === 'login' ? (
                  'Masuk ke Akun'
                ) : (
                  'Simpan Password Baru'
                )}
              </button>
            </form>

            {/* One-click demo logins. Rendered only when the server reports demo
                mode, so a real deployment never shows it. */}
            {demo && mode === 'login' && demo.accounts.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Demo Mode
                  </span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>

                <p className="mt-3 text-center text-xs text-gray-500">
                  Data dummy, tanpa database. Pilih peran untuk masuk langsung.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {demo.accounts.map(account => {
                    const isPending = demoPending === account.email
                    return (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => handleDemoLogin(account)}
                        disabled={!!demoPending || loading}
                        aria-label={`Masuk sebagai ${account.label} — ${account.name}, ${account.scope}`}
                        className="flex flex-col items-start rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-red-300 hover:bg-red-50/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex w-full items-center justify-between gap-1">
                          <span className="truncate text-xs font-bold text-gray-900">{account.label}</span>
                          {isPending && (
                            <svg className="h-3 w-3 flex-shrink-0 animate-spin text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <circle className="opacity-25" cx="12" cy="12" r="10" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                        </span>
                        <span className="mt-0.5 truncate text-[11px] text-gray-500">{account.scope}</span>
                      </button>
                    )
                  })}
                </div>

                <p className="mt-2.5 text-center text-[11px] text-gray-400">
                  Semua akun demo memakai password <code className="font-mono text-gray-500">{demo.password}</code>
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'change-password' : 'login')}
              className="mt-5 w-full text-center text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              {mode === 'login' ? 'Change Password' : 'Kembali ke Login'}
            </button>

            {/* Terms */}
            <p className="mt-6 text-xs text-gray-500 text-center">
              Dengan masuk, Anda menyetujui{' '}
              <a href="#" className="text-red-600 hover:underline">kebijakan privasi</a>{' '}
              dan{' '}
              <a href="#" className="text-red-600 hover:underline">syarat ketentuan</a>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Powered by{' '}
              <a 
                href="https://wit.id" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-red-600 hover:text-red-700 font-medium underline transition-colors"
              >
                WIT.ID
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
