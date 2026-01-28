import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from '../components/ui/use-toast'
import { supabase } from '../lib/supabase'

export function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast({
        title: t('auth.emailRequired'),
        description: t('auth.pleaseEnterEmail'),
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const redirectTo = `${window.location.origin}/update-password`
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (error) throw error

      toast({ title: t('auth.checkYourEmail') })
      setEmail('')
    } catch (err: any) {
      toast({
        title: t('auth.resetLinkSendFailed'),
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1120] px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-white">Şifrenizi mi unuttunuz?</h1>
        <p className="mt-2 text-sm text-slate-300">E-posta adresinizi girin, size sıfırlama bağlantısı gönderelim.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              E-Posta Adresi
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white" disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
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
