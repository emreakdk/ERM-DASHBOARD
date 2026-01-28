import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { ProductForm } from '../components/forms/ProductForm'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useDeleteProduct, useProducts } from '../hooks/useSupabaseQuery'
import { formatCurrency } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQuota } from '../hooks/useQuota'

type ProductRow = Database['public']['Tables']['products']['Row']

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const productsQuery = useProducts()
  const deleteProduct = useDeleteProduct()
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewProducts = canViewModule('products')
  const canEditProducts = canEditModule('products')
  const productQuota = useQuota('products')

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('products.noPermission'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditProducts) {
      showEditDenied()
      return false
    }
    if (!productQuota.canAdd) {
      toast({
        title: t('products.limitExceeded'),
        description: productQuota.message || t('products.productLimitReached'),
        variant: 'destructive',
      })
      return false
    }
    return true
  }, [canEditProducts, showEditDenied, productQuota])

  const products = productsQuery.data ?? []

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products

    return products.filter((p) => {
      const name = String(p.name ?? '').toLowerCase()
      const sku = String(p.sku ?? '').toLowerCase()
      return name.includes(q) || sku.includes(q)
    })
  }, [products, searchQuery])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('products.pageTitle')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewProducts) {
    return (
      <AppLayout title={t('products.pageTitle')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('products.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('products.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  const numberLocale = i18n.language?.startsWith('en') ? 'en-US' : 'tr-TR'

  return (
    <AppLayout title={t('products.pageTitle')}>
      <div className="space-y-6">
        <div>
          <div>
            <h2 className="text-2xl font-semibold">{t('products.pageTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('products.pageDescription')}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">{t('products.productList')}</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('products.searchProductsPlaceholder')}
                  className="pl-9"
                />
              </div>

              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingProduct(null)
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    disabled={!canEditProducts}
                    onClick={() => {
                      if (!ensureCanEdit()) return
                      setEditingProduct(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('products.newProduct')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? t('products.editProduct') : t('products.newProduct')}</DialogTitle>
                  </DialogHeader>
                  <ProductForm
                    initialProduct={editingProduct ?? undefined}
                    onSuccess={() => {
                      setOpen(false)
                      toast({
                        title: editingProduct ? t('products.productUpdated') : t('products.productCreated'),
                      })
                      setEditingProduct(null)
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : productsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(productsQuery.error as any)?.message || t('products.loadFailed')}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('common.name')}</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('products.sku')}</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('common.type')}</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('common.price')}</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('common.stock')}</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">{t('products.emptyList')}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isProduct = p.type === 'product'
                        const badgeClass = isProduct
                          ? 'bg-green-100 text-green-700 border border-transparent dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20'
                          : 'bg-blue-100 text-blue-700 border border-transparent dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20'

                        return (
                          <tr key={p.id} className="border-b">
                            <td className="p-4">
                              <div className="font-medium">{p.name}</div>
                              {p.description ? (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {p.description}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-4">{p.sku || '-'}</td>
                            <td className="p-4">
                              <Badge
                                variant="outline"
                                className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', badgeClass)}
                              >
                                {isProduct ? t('common.product') : t('common.service')}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums">{formatCurrency(Number(p.unit_price ?? 0))}</td>
                            <td className="p-4 text-right tabular-nums">
                              {isProduct ? (p.stock_quantity ?? 0).toLocaleString(numberLocale) : '-'}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!canEditProducts}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setEditingProduct(p)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!canEditProducts}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setDeletingProduct(p)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('common.delete')}
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
          open={Boolean(deletingProduct)}
          onOpenChange={(v) => {
            if (!v) setDeletingProduct(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('products.deleteProduct')}</AlertDialogTitle>
              <AlertDialogDescription>{t('common.deleteWarning')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingProduct(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteProduct.isPending || !deletingProduct}
                onClick={async () => {
                  if (!deletingProduct) return
                  try {
                    await deleteProduct.mutateAsync({
                      id: deletingProduct.id,
                      itemName: deletingProduct.name,
                    })
                    toast({ title: t('products.productDeleted') })
                  } catch (e: any) {
                    toast({
                      title: t('products.deleteFailed'),
                      description: (e as any)?.message || t('common.errorOccurred'),
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingProduct(null)
                  }
                }}
              >
                {t('common.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
