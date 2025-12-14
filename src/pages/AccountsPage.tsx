import { useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { AccountForm } from '../components/forms/AccountForm'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useAccounts, useDeleteAccount } from '../hooks/useSupabaseQuery'
import type { Database } from '../types/database'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'

type AccountRow = Database['public']['Tables']['accounts']['Row']

const typeLabels: Record<AccountRow['type'], string> = {
  bank: 'Banka',
  cash: 'Kasa',
  credit_card: 'Kredi Kartı',
}

const currencySymbols: Record<AccountRow['currency'], string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

export function AccountsPage() {
  const [open, setOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(null)
  const accountsQuery = useAccounts()
  const deleteAccount = useDeleteAccount()

  const accounts = accountsQuery.data ?? []

  const totalsByCurrency = useMemo(() => {
    return accounts.reduce(
      (acc, a) => {
        acc[a.currency] += Number(a.balance ?? 0)
        return acc
      },
      { TRY: 0, USD: 0, EUR: 0 } as Record<AccountRow['currency'], number>
    )
  }, [accounts])

  return (
    <AppLayout title="Kasa ve Banka Hesapları">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Kasa ve Banka Hesapları</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Nakit ve banka hesaplarınızı yönetin
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingAccount(null)
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingAccount(null)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Hesap Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Hesabı Düzenle' : 'Yeni Hesap'}</DialogTitle>
              </DialogHeader>
              <AccountForm
                initialAccount={editingAccount ?? undefined}
                onSuccess={() => {
                  setOpen(false)
                  setEditingAccount(null)
                  toast({
                    title: editingAccount ? 'Hesap güncellendi' : 'Hesap oluşturuldu',
                  })
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          {(['TRY', 'USD', 'EUR'] as const).map((currency) => (
            <Card key={currency}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam ({currency})</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbols[currency]}
                  {totalsByCurrency[currency].toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tüm hesapların toplamı</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="pt-2">
          <h2 className="text-xl font-semibold mb-4 mt-2">Hesap Listesi</h2>
          <Separator />
        </div>

        {accountsQuery.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {accountsQuery.isError && (
          <Card className="border-destructive/50">
            <CardContent className="py-10">
              <p className="text-sm text-destructive">
                {(accountsQuery.error as any)?.message || 'Hesaplar yüklenemedi'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Accounts Grid */}
        {!accountsQuery.isLoading && !accountsQuery.isError && accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Henüz hesap eklenmedi</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                İlk hesabınızı ekleyerek kasa ve banka hesaplarınızı takip etmeye başlayın.
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                İlk Hesabınızı Ekleyin
              </Button>
            </CardContent>
          </Card>
        ) : !accountsQuery.isLoading && !accountsQuery.isError ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {account.name}
                  </CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currencySymbols[account.currency]}
                    {Number(account.balance ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {typeLabels[account.type]}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingAccount(account)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Düzenle
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDeletingAccount(account)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Sil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <AlertDialog
          open={Boolean(deletingAccount)}
          onOpenChange={(v) => {
            if (!v) setDeletingAccount(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingAccount(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteAccount.isPending || !deletingAccount}
                onClick={async () => {
                  if (!deletingAccount) return
                  try {
                    await deleteAccount.mutateAsync(deletingAccount.id)
                    toast({ title: 'Hesap silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingAccount(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
