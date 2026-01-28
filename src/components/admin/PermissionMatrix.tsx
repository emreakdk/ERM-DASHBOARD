import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { useToast } from '../ui/use-toast'
import {
  fetchCompanyPermissions,
  updateCompanyPermissions,
  buildPermissionMatrix,
} from '../../pages/admin/permissionQueries'
import { MODULE_KEYS, type ModuleKey } from '../../constants/permissions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'

type PermissionMatrixProps = {
  companyId: string
  companyName: string
  onUpdated?: () => void
}

export function PermissionMatrix({ companyId, companyName, onUpdated }: PermissionMatrixProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [localPermissions, setLocalPermissions] = useState<
    Record<
      ModuleKey,
      {
        admin: { view: boolean; edit: boolean }
        user: { view: boolean; edit: boolean }
      }
    >
  >({} as any)
  const [hasChanges, setHasChanges] = useState(false)

  const permissionsQuery = useQuery({
    queryKey: ['company_permissions', companyId],
    queryFn: () => fetchCompanyPermissions(companyId),
  })

  useEffect(() => {
    if (permissionsQuery.data) {
      const matrix = buildPermissionMatrix(permissionsQuery.data)
      setLocalPermissions(matrix as any)
    }
  }, [permissionsQuery.data])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(localPermissions).flatMap(([moduleKey, perms]) => [
        {
          role_name: 'admin' as const,
          module_key: moduleKey,
          can_view: perms.admin.view,
          can_edit: perms.admin.edit,
        },
        {
          role_name: 'user' as const,
          module_key: moduleKey,
          can_view: perms.user.view,
          can_edit: perms.user.edit,
        },
      ])
      await updateCompanyPermissions(companyId, permissions)
    },
    onSuccess: () => {
      toast({
        title: t('admin.permissionsUpdated'),
        description: t('admin.permissionsUpdatedDesc', { company: companyName }),
      })
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['company_permissions', companyId] })
      onUpdated?.()
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('admin.permissionsUpdateFailed'),
        variant: 'destructive',
      })
    },
  })

  const handleToggle = (
    moduleKey: ModuleKey,
    role: 'admin' | 'user',
    type: 'view' | 'edit',
    value: boolean
  ) => {
    setLocalPermissions((prev) => {
      const updated = { ...prev }
      if (!updated[moduleKey]) {
        updated[moduleKey] = {
          admin: { view: true, edit: true },
          user: { view: true, edit: false },
        }
      }
      updated[moduleKey] = {
        ...updated[moduleKey],
        [role]: {
          ...updated[moduleKey][role],
          [type]: value,
        },
      }
      return updated
    })
    setHasChanges(true)
  }

  const moduleLabels = useMemo(
    () => ({
      dashboard: t('nav.dashboard'),
      finance: t('nav.finance'),
      customers: t('nav.customers'),
      invoices: t('nav.invoices'),
      quotes: t('nav.quotes'),
      products: t('nav.products'),
      deals: t('nav.deals'),
      activities: t('nav.activities'),
      accounts: t('nav.accounts'),
      settings: t('nav.settings'),
    }),
    [t]
  )

  if (permissionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('admin.permissionMatrix')}</h3>
          <Badge variant="outline">{companyName}</Badge>
        </div>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={!hasChanges || updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('common.save')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">{t('admin.module')}</TableHead>
              <TableHead className="text-center">{t('admin.adminView')}</TableHead>
              <TableHead className="text-center">{t('admin.adminEdit')}</TableHead>
              <TableHead className="text-center">{t('admin.userView')}</TableHead>
              <TableHead className="text-center">{t('admin.userEdit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULE_KEYS.map((moduleKey) => {
              const perms = localPermissions[moduleKey] || {
                admin: { view: true, edit: true },
                user: { view: true, edit: false },
              }
              return (
                <TableRow key={moduleKey}>
                  <TableCell className="font-medium">{moduleLabels[moduleKey]}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={perms.admin.view}
                      onCheckedChange={(value) => handleToggle(moduleKey, 'admin', 'view', value)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={perms.admin.edit}
                      onCheckedChange={(value) => handleToggle(moduleKey, 'admin', 'edit', value)}
                      disabled={!perms.admin.view}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={perms.user.view}
                      onCheckedChange={(value) => handleToggle(moduleKey, 'user', 'view', value)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={perms.user.edit}
                      onCheckedChange={(value) => handleToggle(moduleKey, 'user', 'edit', value)}
                      disabled={!perms.user.view}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('admin.permissionMatrixNote')}
      </p>
    </div>
  )
}
