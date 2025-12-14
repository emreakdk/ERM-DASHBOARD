import { useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { TransactionForm } from '../components/forms/TransactionForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useAccounts, useCustomers, useDeleteTransaction, useTransactions } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { Pencil, Plus, Trash2 } from 'lucide-react'

type TransactionRow = Database['public']['Tables']['transactions']['Row']

export function FinancePage() {
  const [open, setOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(null)
  const transactionsQuery = useTransactions()
  const customersQuery = useCustomers()
  const accountsQuery = useAccounts()
  const deleteTransaction = useDeleteTransaction()

  const transactions = transactionsQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const accountsById = useMemo(() => {
    return new Map((accountsQuery.data ?? []).map((a) => [a.id, a]))
  }, [accountsQuery.data])

  return (
    <AppLayout title="Finans">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Finans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gelir ve gider işlemlerinizi yönetin
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingTransaction(null)
            }}
          >
            <Button
              onClick={() => {
                setEditingTransaction(null)
                setOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Yeni İşlem Ekle
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTransaction ? 'İşlemi Düzenle' : 'Yeni İşlem'}</DialogTitle>
              </DialogHeader>
              <TransactionForm
                initialTransaction={editingTransaction ?? undefined}
                onSuccess={() => {
                  setOpen(false)
                  toast({
                    title: editingTransaction ? 'İşlem güncellendi' : 'İşlem oluşturuldu',
                  })
                  setEditingTransaction(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : transactionsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(transactionsQuery.error as any)?.message || 'İşlemler yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tarih
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tür
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Kategori
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Hesap
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Müşteri
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        Tutar
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">
                            Henüz işlem bulunamadı.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        const customer = t.customer_id ? customersById.get(t.customer_id) : undefined
                        const account = t.bank_account ? accountsById.get(t.bank_account) : undefined
                        return (
                          <tr key={t.id} className="border-b">
                            <td className="p-4">{formatShortDate(t.transaction_date)}</td>
                            <td className="p-4">
                              <Badge
                                variant={t.type === 'expense' ? 'destructive' : 'default'}
                                className={t.type === 'income' ? 'bg-emerald-500 hover:bg-emerald-500/90 text-white border-transparent' : undefined}
                              >
                                {t.type === 'income' ? 'Gelir' : 'Gider'}
                              </Badge>
                            </td>
                            <td className="p-4">{t.category}</td>
                            <td className="p-4">{account?.name || '-'}</td>
                            <td className="p-4">{customer?.name || '-'}</td>
                            <td className="p-4 text-right font-medium">{formatCurrency(Number(t.amount))}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTransaction(t)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingTransaction(t)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingTransaction)}
          onOpenChange={(v) => {
            if (!v) setDeletingTransaction(null)
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
              <Button variant="outline" onClick={() => setDeletingTransaction(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTransaction.isPending || !deletingTransaction}
                onClick={async () => {
                  if (!deletingTransaction) return
                  try {
                    await deleteTransaction.mutateAsync(deletingTransaction.id)
                    toast({ title: 'İşlem silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingTransaction(null)
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
