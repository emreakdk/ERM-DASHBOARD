import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { DealForm } from '../components/forms/DealForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useCustomers, useDeals, useDeleteDeal, useUpdateDeal } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import { Kanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQuota } from '../hooks/useQuota'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useLocation, useNavigate } from 'react-router-dom'

type DealRow = Database['public']['Tables']['deals']['Row']

type Stage = DealRow['stage']

const stageOrder: Stage[] = ['new', 'meeting', 'proposal', 'negotiation', 'won', 'lost']

const getStageLabels = (t: (key: string) => string): Record<Stage, string> => ({
  new: t('deals.newOpportunity'),
  meeting: t('deals.meeting'),
  proposal: t('deals.proposal'),
  negotiation: t('deals.negotiation'),
  won: t('deals.won'),
  lost: t('deals.lost'),
})

const stageHeaderClasses: Record<Stage, string> = {
  new: 'bg-muted/40 dark:bg-muted/15',
  meeting: 'bg-blue-50/50 dark:bg-blue-950/25',
  proposal: 'bg-indigo-50/50 dark:bg-indigo-950/25',
  negotiation: 'bg-amber-50/50 dark:bg-amber-950/25',
  won: 'bg-emerald-50/60 dark:bg-emerald-950/30',
  lost: 'bg-red-50/60 dark:bg-red-950/30',
}

const stageBadgeClasses: Record<Stage, string> = {
  new: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  meeting: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  proposal: 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
  negotiation: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  won: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  lost: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

export function DealsPage() {
  const { t } = useTranslation()
  const stageLabels = getStageLabels(t)
  const navigate = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null)
  const [deletingDeal, setDeletingDeal] = useState<DealRow | null>(null)

  const [localDeals, setLocalDeals] = useState<DealRow[]>([])
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [pendingWonDeal, setPendingWonDeal] = useState<DealRow | null>(null)

  const dealsQuery = useDeals()
  const customersQuery = useCustomers()
  const deleteDeal = useDeleteDeal()
  const updateDeal = useUpdateDeal()
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewDeals = canViewModule('deals')
  const canEditDeals = canEditModule('deals')
  const dealQuota = useQuota('deals')

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('deals.noPermission'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditDeals) {
      showEditDenied()
      return false
    }
    if (!dealQuota.canAdd) {
      toast({
        title: t('deals.limitExceeded'),
        description: dealQuota.message || t('deals.dealLimitReached'),
        variant: 'destructive',
      })
      return false
    }
    return true
  }, [canEditDeals, showEditDenied, dealQuota])

  const deals = localDeals

  useEffect(() => {
    if (activeDealId) return
    setLocalDeals(dealsQuery.data ?? [])
  }, [activeDealId, dealsQuery.data])

  useEffect(() => {
    const state = (location.state ?? {}) as any
    if (state?.openNew) {
      if (!canEditDeals) {
        showEditDenied()
        navigate(location.pathname, { replace: true, state: null })
        return
      }
      setEditingDeal(null)
      setOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, canEditDeals, showEditDenied])

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const dealsByStage = useMemo(() => {
    const map = new Map<Stage, DealRow[]>()
    for (const s of stageOrder) map.set(s, [])
    for (const d of deals) {
      const arr = map.get(d.stage) ?? []
      arr.push(d)
      map.set(d.stage, arr)
    }
    return map
  }, [deals])

  const stageTotals = useMemo(() => {
    const totals = new Map<Stage, number>()
    for (const s of stageOrder) {
      const sum = (dealsByStage.get(s) ?? []).reduce((acc, d) => acc + Number(d.value ?? 0), 0)
      totals.set(s, sum)
    }
    return totals
  }, [dealsByStage])

  const pipelineTotal = useMemo(() => {
    const active: Stage[] = ['new', 'meeting', 'proposal', 'negotiation']
    return active.reduce((acc, s) => acc + (stageTotals.get(s) ?? 0), 0)
  }, [stageTotals])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function findDealById(id: string) {
    return deals.find((d) => d.id === id)
  }

  async function persistStageChange(dealId: string, stage: Stage) {
    try {
      await updateDeal.mutateAsync({ id: dealId, patch: { stage } })
    } catch (e: any) {
      const msg = e?.message || t('admin.unknownError')
      toast({ title: t('common.updateFailed'), description: msg, variant: 'destructive' })
      dealsQuery.refetch()
    }
  }

  function dealToInvoicePrefill(deal: DealRow) {
    return {
      customerId: deal.customer_id,
      items: [
        {
          description: `Hizmet Bedeli: ${deal.title}`,
          quantity: 1,
          unitPrice: Number(deal.value ?? 0),
        },
      ],
      notes: `Bu fatura "${deal.title}" fırsatından dönüştürüldü.`,
    }
  }

  function Column({ stage, children }: { stage: Stage; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: stage })
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border border-border transition-colors',
          stageHeaderClasses[stage],
          isOver && 'ring-2 ring-primary/30'
        )}
      >
        {children}
      </div>
    )
  }

  function DealCard({ deal }: { deal: DealRow }) {
    const customerName = customersById.get(deal.customer_id)?.name ?? '-'
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })

    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform) }}
        className={cn(
          'rounded-lg border bg-background shadow-sm p-3 cursor-grab active:cursor-grabbing select-none',
          isDragging && 'shadow-lg ring-1 ring-border opacity-90'
        )}
        {...listeners}
        {...attributes}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{deal.title}</div>
            <div className="text-xs text-muted-foreground truncate mt-1">{customerName}</div>
          </div>
          <Badge variant="outline" className={cn('capitalize', stageBadgeClasses[deal.stage])}>
            {stageLabels[deal.stage]}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(deal.value ?? 0))}</div>
          <div className="text-xs text-muted-foreground">{formatShortDate(deal.expected_close_date)}</div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!canEditDeals}
            onClick={() => {
              if (!ensureCanEdit()) return
              setEditingDeal(deal)
              setOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t('common.edit')}</span>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            disabled={!canEditDeals}
            onClick={() => {
              if (!ensureCanEdit()) return
              setDeletingDeal(deal)
            }}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t('common.delete')}</span>
          </Button>
        </div>
      </div>
    )
  }

  if (permissionsLoading) {
    return (
      <AppLayout title={t('nav.deals')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewDeals) {
    return (
      <AppLayout title={t('nav.deals')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('deals.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('deals.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('nav.deals')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('nav.deals')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('deals.manageDeals')}</p>
          </div>

          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingDeal(null)
            }}
          >
            <DialogTrigger asChild>
              <Button
                disabled={!canEditDeals}
                onClick={() => {
                  if (!ensureCanEdit()) return
                  setEditingDeal(null)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('deals.newDeal')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDeal ? t('deals.editDeal') : t('deals.newDeal')}</DialogTitle>
              </DialogHeader>
              <DealForm
                initialDeal={editingDeal ?? undefined}
                onSuccess={() => {
                  setOpen(false)
                  toast({
                    title: editingDeal ? t('deals.dealUpdated') : t('deals.dealCreated'),
                  })
                  setEditingDeal(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Total Pipeline Value</CardTitle>
            <div className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-muted-foreground" />
              <div className="text-lg font-bold tabular-nums">{formatCurrency(pipelineTotal)}</div>
            </div>
          </CardHeader>
        </Card>

        {dealsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : dealsQuery.isError ? (
          <p className="text-sm text-destructive">
            {(dealsQuery.error as any)?.message || t('common.loadFailed')}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(event: DragStartEvent) => {
              setActiveDealId(String(event.active.id))
            }}
            onDragEnd={(event: DragEndEvent) => {
              if (!canEditDeals) {
                showEditDenied()
                setActiveDealId(null)
                return
              }
              const dealId = String(event.active.id)
              setActiveDealId(null)
              if (!event.over) return

              const targetStage = String(event.over.id) as Stage
              const deal = findDealById(dealId)
              if (!deal) return

              const currentStage = deal.stage
              if (currentStage === targetStage) return

              setLocalDeals((prev) =>
                prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d))
              )

              void persistStageChange(dealId, targetStage)

              if (targetStage === 'won') {
                setPendingWonDeal({ ...deal, stage: targetStage })
              }
            }}
          >
            <div className="overflow-x-auto lg:overflow-visible">
              <div className="flex gap-4 min-w-max lg:min-w-0 lg:w-full pb-2">
                {stageOrder.map((stage) => {
                  const list = dealsByStage.get(stage) ?? []
                  const total = stageTotals.get(stage) ?? 0

                  return (
                    <div key={stage} className="w-[320px] shrink-0 lg:flex-1 lg:w-auto lg:min-w-0">
                      <Column stage={stage}>
                        <div className="px-4 py-3 border-b border-border/50">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{stageLabels[stage]}</div>
                            <Badge variant="outline" className={cn('tabular-nums', stageBadgeClasses[stage])}>
                              {formatCurrency(total)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {list.length.toLocaleString('tr-TR')} kayıt
                          </div>
                        </div>

                        <div className="p-3 space-y-3">
                          {list.length === 0 ? (
                            <div className="rounded-md border border-dashed border-border/60 bg-background/40 dark:bg-background/10 p-4 text-center text-sm text-muted-foreground">
                              Boş
                            </div>
                          ) : (
                            list.map((d) => <DealCard key={d.id} deal={d} />)
                          )}
                        </div>
                      </Column>
                    </div>
                  )
                })}
              </div>
            </div>
          </DndContext>
        )}

        <AlertDialog
          open={Boolean(pendingWonDeal)}
          onOpenChange={(v) => {
            if (!v) setPendingWonDeal(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fırsat Kazanıldı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu fırsat başarıyla kapatıldı. İlgili tutar için hemen fatura oluşturmak ister misiniz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Kapat</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const deal = pendingWonDeal
                  setPendingWonDeal(null)
                  if (!deal) return

                  navigate('/invoices/new', {
                    state: { prefill: dealToInvoicePrefill(deal) },
                  })
                }}
              >
                Fatura Oluştur
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {deletingDeal ? (
          <Dialog
            open={Boolean(deletingDeal)}
            onOpenChange={(v) => {
              if (!v) setDeletingDeal(null)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('common.deleteConfirm')}</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">
                {t('common.deleteWarning')}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeletingDeal(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteDeal.isPending}
                  onClick={async () => {
                    try {
                      await deleteDeal.mutateAsync({ id: deletingDeal.id, itemName: deletingDeal.title })
                      toast({ title: t('deals.dealDeleted') })
                    } catch (e: any) {
                      toast({
                        title: t('common.deleteFailed'),
                        description: e?.message || t('admin.unknownError'),
                        variant: 'destructive',
                      })
                    } finally {
                      setDeletingDeal(null)
                    }
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </AppLayout>
  )
}
