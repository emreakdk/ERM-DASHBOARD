import { useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateInvoiceForm } from '../components/forms/CreateInvoiceForm'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useCustomers, useDeleteInvoice, useInvoiceItems, useInvoices } from '../hooks/useSupabaseQuery'
import { INVOICE_STATUS_LABELS } from '../lib/constants'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { Pencil, Plus, Trash2 } from 'lucide-react'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

const statusVariants: Record<InvoiceRow['status'], 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  cancelled: 'destructive',
}

export function InvoicesPage() {
  const [open, setOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const invoicesQuery = useInvoices()
  const customersQuery = useCustomers()
  const deleteInvoice = useDeleteInvoice()

  const invoiceItemsQuery = useInvoiceItems(editingInvoice?.id)

  const invoices = invoicesQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  return (
    <AppLayout title="Faturalar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Faturalar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Faturalarınızı oluşturun ve yönetin
            </p>
          </div>
          <Sheet
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingInvoice(null)
            }}
          >
            <SheetTrigger asChild>
              <Button
                onClick={() => {
                  setEditingInvoice(null)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Yeni Fatura
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[800px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingInvoice ? 'Faturayı Düzenle' : 'Fatura Oluştur'}</SheetTitle>
              </SheetHeader>
              <div className="px-6 pb-6">
                <CreateInvoiceForm
                  initialInvoice={editingInvoice ?? undefined}
                  initialItems={invoiceItemsQuery.data ?? undefined}
                  onSuccess={() => {
                    setOpen(false)
                    toast({
                      title: editingInvoice ? 'Fatura güncellendi' : 'Fatura oluşturuldu',
                    })
                    setEditingInvoice(null)
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Fatura Listesi</CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoicesQuery.isError ? (
              <p className="text-sm text-destructive">
                {(invoicesQuery.error as any)?.message || 'Faturalar yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Fatura No
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tarih
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Müşteri
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Durum
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        Toplam
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">
                            Henüz fatura oluşturulmadı.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => {
                        const customer = customersById.get(inv.customer_id)
                        return (
                          <tr key={inv.id} className="border-b">
                            <td className="p-4 font-medium">{inv.invoice_number}</td>
                            <td className="p-4">{formatShortDate(inv.invoice_date)}</td>
                            <td className="p-4">{customer?.name || '-'}</td>
                            <td className="p-4">
                              <Badge variant={statusVariants[inv.status]}>
                                {INVOICE_STATUS_LABELS[inv.status]}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium">
                              {formatCurrency(Number(inv.total_amount))}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingInvoice(inv)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingInvoice(inv)}
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
          open={Boolean(deletingInvoice)}
          onOpenChange={(v) => {
            if (!v) setDeletingInvoice(null)
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
              <Button variant="outline" onClick={() => setDeletingInvoice(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteInvoice.isPending || !deletingInvoice}
                onClick={async () => {
                  if (!deletingInvoice) return
                  try {
                    await deleteInvoice.mutateAsync(deletingInvoice.id)
                    toast({ title: 'Fatura silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingInvoice(null)
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
