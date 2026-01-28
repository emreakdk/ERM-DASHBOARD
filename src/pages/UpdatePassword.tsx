import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from '../components/ui/use-toast'
import { supabase } from '../lib/supabase'

const createErrorMessage = (fallback: string) => (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return fallback
}

export function UpdatePassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const getErrorMessage = useCallback(createErrorMessage(t('common.unexpectedError')), [t])

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let subscription: { unsubscribe: () => void } | undefined

    const markReadyIfSessionExists = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return Boolean(session)

      if (session) {
        setReady(true)
        setCheckingSession(false)
        return true
      }

      return false
    }

    const init = async () => {
      const alreadyReady = await markReadyIfSessionExists()
      if (alreadyReady || cancelled) return

      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return
        if (!session) return

        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setReady(true)
          setCheckingSession(false)
        }
      })

      subscription = sub

      timeoutId = setTimeout(async () => {
        if (cancelled) return

        const nowReady = await markReadyIfSessionExists()
        if (cancelled || nowReady) return

        setCheckingSession(false)
        toast({
          title: t('auth.invalidOrExpiredLink'),
          description: t('auth.pleaseRequestPasswordReset'),
          variant: 'destructive',
        })
        navigate('/login', { replace: true })
      }, 2500)
    }

    init()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      subscription?.unsubscribe()
    }
  }, [navigate, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!ready) {
      toast({
        title: t('auth.verifyingSession'),
        description: t('auth.pleaseTryAgainInFewSeconds'),
        variant: 'destructive',
      })
      return
    }

    const p1 = newPassword
    const p2 = confirmPassword

    if (!p1 || !p2) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: t('auth.pleaseFillAllFields'),
        variant: 'destructive',
      })
      return
    }

    if (p1 !== p2) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: t('auth.passwordsDoNotMatch'),
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password: p1 })
      if (error) throw error

      toast({ title: t('auth.passwordUpdatedSuccessfully') })
      navigate('/login')
    } catch (error) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1120] px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-white">Yeni Şifre Belirle</h1>
          <p className="mt-2 text-sm text-slate-300">
            {checkingSession ? 'Bağlantı doğrulanıyor...' : 'Bağlantı doğrulanamadı.'}
          </p>

          <div className="mt-6 text-sm">
            <Link to="/login" className="text-slate-300 hover:text-slate-200">
              Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1120] px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-white">Yeni Şifre Belirle</h1>
        <p className="mt-2 text-sm text-slate-300">Hesabınız için yeni bir şifre oluşturun.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-slate-200">
              Yeni Şifre
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Yeni şifreniz"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500 pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-200">
              Yeni Şifre (Tekrar)
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Şifreyi onaylayın"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white" disabled={loading || !ready}>
            {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </Button>
        </form>

        <div className="mt-6 text-sm">
          <Link to="/login" className="text-slate-300 hover:text-slate-200">
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  )
}
