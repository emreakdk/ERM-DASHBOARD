import { AlertTriangle, TrendingUp, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useNavigate } from 'react-router-dom'

interface UpgradeRequiredModalProps {
  open: boolean
  onClose: () => void
  reason?: string
  message?: string
  current?: number
  limit?: number
  resourceType?: string
}

export function UpgradeRequiredModal({
  open,
  onClose,
  reason,
  message,
  current,
  limit,
  resourceType,
}: UpgradeRequiredModalProps) {
  const navigate = useNavigate()

  const handleViewPlans = () => {
    onClose()
    navigate('/admin/packages')
  }

  const getResourceLabel = (type?: string) => {
    const labels: Record<string, string> = {
      invoices: 'Fatura',
      users: 'Kullanıcı',
      customers: 'Müşteri',
      products: 'Ürün',
      deals: 'Anlaşma',
      quotes: 'Teklif',
    }
    return labels[type || ''] || 'Kayıt'
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-xl">Plan Yükseltme Gerekli</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Mevcut planınızın limitine ulaştınız
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {reason === 'quota_exceeded' && current !== undefined && limit !== undefined && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Mevcut Kullanım</span>
                <Badge variant="destructive">{getResourceLabel(resourceType)} Limiti</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${Math.min((current / limit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {current} / {limit}
                </span>
              </div>
            </div>
          )}

          {reason === 'no_plan' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Şirketinize henüz bir abonelik planı atanmamış. Lütfen bir plan seçin veya sistem
                yöneticinizle iletişime geçin.
              </p>
            </div>
          )}

          {message && (
            <div className="text-sm text-muted-foreground border-l-2 border-amber-500 pl-4 py-2">
              {message}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium">Daha yüksek bir plana geçerek:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Daha fazla {getResourceLabel(resourceType).toLowerCase()} oluşturabilirsiniz</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Gelişmiş özelliklere erişim sağlayabilirsiniz</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Öncelikli destek alabilirsiniz</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
          <Button onClick={handleViewPlans} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Planları Görüntüle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
