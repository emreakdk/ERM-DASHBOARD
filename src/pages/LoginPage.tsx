import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Eye, EyeOff, LayoutDashboard, ShieldCheck, Sparkles, LineChart } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

function translateAuthError(message: string, t: (key: string) => string) {
  const m = (message || '').toLowerCase()

  if (m.includes('invalid login credentials')) return t('auth.invalidCredentials')
  if (m.includes('email not confirmed')) return t('auth.emailNotConfirmed')
  if (m.includes('too many requests')) return t('auth.tooManyRequests')
  if (m.includes('user not found')) return t('auth.invalidCredentials')
  if (m.includes('invalid email')) return t('auth.invalidEmail')

  return t('auth.loginError')
}

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn, blockMessage } = useAuth()
  const { refreshTenant } = useTenant()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(translateAuthError(error.message, t))
      } else {
        await refreshTenant()
        navigate('/')
      }
    } catch {
      setError(t('common.errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md space-y-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t('auth.ermPlatform')}</p>
              <p className="text-white font-semibold tracking-tight text-lg">{t('auth.controlPanel')}</p>
            </div>
          </div>

          <div className="space-y-3 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              {t('auth.rolePermissionControl')}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">{t('auth.loginTitle')}</h1>
              <p className="mt-3 text-sm text-slate-400">
                {t('auth.loginSubtitle')}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {t('auth.noAccountContact')}{' '}
                <span className="text-slate-200 font-semibold">emreakbudak006@gmail.com</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200 text-sm">
                {t('auth.emailAddress')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@sube.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="rounded-2xl border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="password" className="text-slate-200">
                  {t('auth.password')}
                </Label>
                <Link to="/forgot-password" className="text-slate-300 hover:text-white">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="rounded-2xl border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 pr-12 focus-visible:ring-2 focus-visible:ring-slate-400"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {(error || blockMessage) && (
              <div className="text-sm text-red-200 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-2xl">
                {blockMessage || error}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-300">
              <label className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-lg border-slate-600 bg-slate-900 accent-slate-100"
                />
                {t('auth.rememberMe')}
              </label>
              <div className="flex items-center gap-1 text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                {t('auth.encryption')}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-slate-100 to-slate-300 text-slate-900 font-semibold shadow-lg shadow-slate-900/40 hover:from-white hover:to-slate-200"
              disabled={loading}
            >
              {loading ? t('auth.loggingIn') : t('auth.enterControlPanel')}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,118,110,0.25),_transparent_50%)]" />
        <div className="absolute inset-0 opacity-60 blur-[120px] bg-gradient-to-br from-slate-600 via-slate-900 to-slate-950" />
        <div className="relative z-10 m-auto grid w-[420px] gap-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>{t('auth.companySummary')}</span>
              <span>{t('common.today')}</span>
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <div>
                <p className="text-sm text-slate-300">{t('auth.totalCollection')}</p>
                <p className="mt-2 text-4xl font-black text-white">₺842.560</p>
              </div>
              <div className="rounded-2xl bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                +18%
              </div>
            </div>
            <div className="mt-6 h-24 rounded-2xl bg-gradient-to-r from-slate-700/40 to-slate-800/40 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{t('auth.activeUsers')}</span>
                <span>128 {t('common.people')}</span>
              </div>
              <div className="mt-4 flex h-8 items-center gap-1">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-lg bg-slate-500/30"
                    style={{ height: `${40 + Math.sin(idx) * 20}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900/80 p-3 text-slate-200">
                <LineChart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Multi-Tenancy</p>
                <p className="text-lg font-semibold text-white">{t('auth.companyIsolation')}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              {t('auth.isolationDescription')}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-200">
              {t('auth.exploreMore')}
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                RBAC
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
