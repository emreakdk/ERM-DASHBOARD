import { useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { CustomerForm } from '../components/forms/CustomerForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useCustomers, useDeleteCustomer, useDeleteCustomerCascade } from '../hooks/useSupabaseQuery'
import type { Database } from '../types/database'
import { Building2, Pencil, Plus, Trash2, User } from 'lucide-react'

type CustomerRow = Database['public']['Tables']['customers']['Row']

export function CustomersPage() {
  const [open, setOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null)
  const [cascadeDeletingCustomer, setCascadeDeletingCustomer] = useState<CustomerRow | null>(null)
  const customersQuery = useCustomers()
  const deleteCustomer = useDeleteCustomer()
  const deleteCustomerCascade = useDeleteCustomerCascade()

  const customers = customersQuery.data ?? []

  return (
    <AppLayout title="Müşteriler">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Müşteriler</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Müşteri bilgilerinizi yönetin
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingCustomer(null)
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingCustomer(null)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Müşteri Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</DialogTitle>
              </DialogHeader>
              <CustomerForm
                initialCustomer={editingCustomer ?? undefined}
                onSuccess={() => {
                  setOpen(false)
                  toast({
                    title: editingCustomer ? 'Müşteri güncellendi' : 'Müşteri oluşturuldu',
                  })
                  setEditingCustomer(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Müşteri Listesi</CardTitle>
          </CardHeader>
          <CardContent>
            {customersQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : customersQuery.isError ? (
              <p className="text-sm text-destructive">
                {(customersQuery.error as any)?.message || 'Müşteriler yüklenemedi'}
              </p>
            ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      İsim
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Telefon
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      E-posta
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-32 text-center">
                        <p className="text-sm text-muted-foreground">
                          Müşteri listeniz boş.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="border-b">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                customer.type === 'corporate'
                                  ? 'h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center'
                                  : 'h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center'
                              }
                            >
                              {customer.type === 'corporate' ? (
                                <Building2 className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                            <span className="font-medium">{customer.name}</span>
                          </div>
                        </td>
                        <td className="p-4">{customer.phone || '-'}</td>
                        <td className="p-4">{customer.email || '-'}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingCustomer(customer)
                                setOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Düzenle
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeletingCustomer(customer)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingCustomer)}
          onOpenChange={(v) => {
            if (!v) setDeletingCustomer(null)
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
              <Button variant="outline" onClick={() => setDeletingCustomer(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteCustomer.isPending || !deletingCustomer}
                onClick={async () => {
                  if (!deletingCustomer) return
                  try {
                    await deleteCustomer.mutateAsync(deletingCustomer.id)
                    toast({ title: 'Müşteri silindi' })
                  } catch (e: any) {
                    const code = e?.code as string | undefined
                    const message = (e?.message as string | undefined) ?? ''
                    const details = (e?.details as string | undefined) ?? ''
                    const hint = (e?.hint as string | undefined) ?? ''
                    const isFkViolation =
                      code === '23503' ||
                      message.toLowerCase().includes('foreign key constraint') ||
                      details.toLowerCase().includes('foreign key')

                    if (isFkViolation) {
                      setCascadeDeletingCustomer(deletingCustomer)
                      setDeletingCustomer(null)
                      return
                    }

                    toast({
                      title: 'Silme işlemi başarısız',
                      description: hint || details || message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingCustomer(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(cascadeDeletingCustomer)}
          onOpenChange={(v) => {
            if (!v) setCascadeDeletingCustomer(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu müşteriye ait faturalar olduğu için doğrudan silinemiyor. Faturalarla birlikte bu müşteriyi
                silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setCascadeDeletingCustomer(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteCustomerCascade.isPending || !cascadeDeletingCustomer}
                onClick={async () => {
                  if (!cascadeDeletingCustomer) return
                  try {
                    await deleteCustomerCascade.mutateAsync(cascadeDeletingCustomer.id)
                    toast({ title: 'Müşteri ve faturaları silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.hint || e?.details || e?.message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setCascadeDeletingCustomer(null)
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
