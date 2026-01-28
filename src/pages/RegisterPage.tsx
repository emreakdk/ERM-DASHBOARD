import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react'

export function RegisterPage() {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await signUp(email, password, fullName)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/')
        }, 1500)
      }
    } catch {
      setError(t('common.errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="h-screen lg:grid lg:grid-cols-2">
        <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 bg-[#0B1120]">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <div className="text-white font-semibold tracking-tight">ERM Dashboard</div>
            </div>

            <div className="mt-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <h2 className="text-lg font-semibold text-emerald-200">{t('auth.registrationSuccess')}</h2>
              <p className="mt-1 text-sm text-emerald-200/80">{t('auth.redirecting')}</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:block relative">
          <img
            src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80"
            alt="Register visual"
            className="object-cover w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-black/10 to-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen lg:grid lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 bg-[#0B1120]">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div className="text-white font-semibold tracking-tight">ERM Dashboard</div>
          </div>

          <div className="mt-10">
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('auth.createAccountTitle')}</h1>
            <p className="mt-2 text-sm text-slate-300">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                {t('auth.login')}
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-200">{t('forms.fullName')}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t('forms.fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">{t('auth.emailAddress')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('forms.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">{t('auth.minCharacters', { count: 6 })}</p>
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              disabled={loading}
            >
              {loading ? t('auth.registering') : t('auth.register')}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80"
          alt="Register visual"
          className="object-cover w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-black/10 to-transparent" />
      </div>
    </div>
  )
}
