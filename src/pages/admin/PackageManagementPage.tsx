import { useState, useMemo } from 'react'
import { SystemAdminLayout } from '../../components/layout/SystemAdminLayout'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Package, Plus, Edit, Trash2 } from 'lucide-react'
import {
  useSubscriptionPlans,
  useCreateSubscriptionPlan,
  useUpdateSubscriptionPlan,
  useDeleteSubscriptionPlan,
} from '../../hooks/useSubscription'
import type { SubscriptionPlan, PlanFeatures } from '../../types/subscription'
import { formatCurrency } from '../../lib/format'
import { useTranslation } from 'react-i18next'

const defaultFeatures: PlanFeatures = {
  max_users: 5,
  max_invoices: 100,
  max_customers: 500,
  max_products: 200,
  max_deals: 50,
  max_quotes: 100,
  max_storage_mb: 1000,
  modules: {
    finance: true,
    invoices: true,
    customers: true,
    products: true,
    quotes: true,
    deals: true,
    accounts: true,
    reports: false,
    api_access: false,
  },
}

export function PackageManagementPage() {
  const { t } = useTranslation()
  type PlanWithFeatures = Omit<SubscriptionPlan, 'billing_period'> & {
    billing_period: string
  }

  const [editDialog, setEditDialog] = useState<{
    open: boolean
    plan: PlanWithFeatures | null
  }>({ open: false, plan: null })

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    plan: PlanWithFeatures | null
  }>({ open: false, plan: null })

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    price: 0,
    currency: 'TRY',
    billing_period: 'monthly' as 'monthly' | 'yearly',
    is_active: true,
    is_featured: false,
    sort_order: 0,
    features: defaultFeatures,
  })

  const plansQuery = useSubscriptionPlans()
  const createPlan = useCreateSubscriptionPlan()
  const updatePlan = useUpdateSubscriptionPlan()
  const deletePlan = useDeleteSubscriptionPlan()

  const plans = plansQuery.data ?? []

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      price: 0,
      currency: 'TRY',
      billing_period: 'monthly',
      is_active: true,
      is_featured: false,
      sort_order: plans.length,
      features: defaultFeatures,
    })
    setEditDialog({ open: true, plan: null })
  }

  const handleOpenEdit = (plan: PlanWithFeatures) => {
    setFormData({
      name: plan.name,
      display_name: plan.display_name,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency,
      billing_period: plan.billing_period as 'monthly' | 'yearly',
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      sort_order: plan.sort_order,
      features: plan.features,
    })
    setEditDialog({ open: true, plan })
  }

  const handleSave = async () => {
    try {
      if (editDialog.plan) {
        await updatePlan.mutateAsync({
          id: editDialog.plan.id,
          updates: formData,
        })
      } else {
        await createPlan.mutateAsync(formData)
      }
      setEditDialog({ open: false, plan: null })
    } catch {
      // Error handled by mutation
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.plan) return
    try {
      await deletePlan.mutateAsync(deleteDialog.plan.id)
      setDeleteDialog({ open: false, plan: null })
    } catch {
      // Error handled by mutation
    }
  }

  const updateFeature = (key: keyof PlanFeatures, value: number) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      },
    }))
  }

  const updateModule = (module: keyof PlanFeatures['modules'], enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        modules: {
          ...prev.features.modules,
          [module]: enabled,
        },
      },
    }))
  }

  const planLimitLabels = useMemo(() => ({
    users: t('packages.limitUsers'),
    invoices: t('packages.limitInvoices'),
    customers: t('packages.limitCustomers'),
  }), [t])

  const moduleLabels: Record<keyof PlanFeatures['modules'], string> = {
    finance: t('packages.modules.finance'),
    invoices: t('packages.modules.invoices'),
    customers: t('packages.modules.customers'),
    products: t('packages.modules.products'),
    quotes: t('packages.modules.quotes'),
    deals: t('packages.modules.deals'),
    accounts: t('packages.modules.accounts'),
    reports: t('packages.modules.reports'),
    api_access: t('packages.modules.apiAccess'),
  }

  return (
    <SystemAdminLayout
      title={t('packages.title')}
      description={t('packages.subtitle')}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('packages.subscriptionPlans')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('packages.subscriptionPlansDescription')}
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('packages.addPlan')}
          </Button>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('packages.plansTitle')}
            </CardTitle>
            <CardDescription>
              {t('packages.planCount', { count: plans.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plansQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : plansQuery.isError ? (
              <div className="text-center py-8 text-destructive">
                {t('packages.loadFailed', { error: (plansQuery.error as any)?.message })}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('packages.noPlans')}
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">{t('packages.table.plan')}</TableHead>
                      <TableHead className="font-semibold">{t('packages.table.price')}</TableHead>
                      <TableHead className="font-semibold">{t('packages.table.limits')}</TableHead>
                      <TableHead className="font-semibold">{t('packages.table.status')}</TableHead>
                      <TableHead className="text-right font-semibold">{t('packages.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                              {plan.display_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{plan.display_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {plan.description || t('packages.noDescription')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">
                            {formatCurrency(plan.price)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {plan.billing_period === 'monthly' ? t('packages.billing.monthly') : t('packages.billing.yearly')}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div>
                              👥 {plan.features.max_users === -1 ? '∞' : plan.features.max_users} {planLimitLabels.users}
                            </div>
                            <div>
                              📄 {plan.features.max_invoices === -1 ? '∞' : plan.features.max_invoices} {planLimitLabels.invoices}
                            </div>
                            <div>
                              👤 {plan.features.max_customers === -1 ? '∞' : plan.features.max_customers} {planLimitLabels.customers}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Badge
                              variant={plan.is_active ? 'default' : 'secondary'}
                              className="w-fit"
                            >
                              {plan.is_active ? t('status.active') : t('status.inactive')}
                            </Badge>
                            {plan.is_featured && (
                              <Badge variant="outline" className="w-fit bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                ⭐ {t('packages.featured')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteDialog({ open: true, plan })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, plan: null })}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editDialog.plan ? t('packages.editDialog.title') : t('packages.createDialog.title')}
              </DialogTitle>
              <DialogDescription>
                {editDialog.plan ? t('packages.editDialog.description') : t('packages.createDialog.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold">{t('packages.basicInfo.title')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('packages.basicInfo.name')}</Label>
                    <Input
                      id="name"
                      placeholder="basic, pro, unlimited"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">{t('packages.basicInfo.displayName')}</Label>
                    <Input
                      id="display_name"
                      placeholder="Temel Plan"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('packages.basicInfo.description')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('packages.basicInfo.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">{t('packages.basicInfo.price')}</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t('packages.basicInfo.currency')}</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY (₺)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_period">{t('packages.basicInfo.billingPeriod')}</Label>
                    <Select
                      value={formData.billing_period}
                      onValueChange={(value: 'monthly' | 'yearly') =>
                        setFormData({ ...formData, billing_period: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{t('packages.billing.monthly')}</SelectItem>
                        <SelectItem value="yearly">{t('packages.billing.yearly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>{t('packages.basicInfo.active')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                    <Label>{t('packages.basicInfo.featured')}</Label>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-4">
                <h3 className="font-semibold">{t('packages.limits.title')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxUsers')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_users}
                      onChange={(e) => updateFeature('max_users', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxInvoices')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_invoices}
                      onChange={(e) => updateFeature('max_invoices', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxCustomers')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_customers}
                      onChange={(e) => updateFeature('max_customers', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxProducts')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_products}
                      onChange={(e) => updateFeature('max_products', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxDeals')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_deals}
                      onChange={(e) => updateFeature('max_deals', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.maxQuotes')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_quotes}
                      onChange={(e) => updateFeature('max_quotes', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('packages.limits.storage')}</Label>
                    <Input
                      type="number"
                      value={formData.features.max_storage_mb}
                      onChange={(e) => updateFeature('max_storage_mb', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="space-y-4">
                <h3 className="font-semibold">{t('packages.modules.title')}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(formData.features.modules).map(([module, enabled]) => (
                    <div key={module} className="flex items-center justify-between rounded-lg border p-3">
                      <Label className="cursor-pointer">
                        {moduleLabels[module as keyof PlanFeatures['modules']]}
                      </Label>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          updateModule(module as keyof PlanFeatures['modules'], checked)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ open: false, plan: null })}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={createPlan.isPending || updatePlan.isPending}>
                {editDialog.plan ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, plan: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('packages.deleteDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('packages.deleteDialog.description', { name: deleteDialog.plan?.display_name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, plan: null })}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePlan.isPending}
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SystemAdminLayout>
  )
}
