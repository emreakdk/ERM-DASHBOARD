import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { AddActivityDialog } from '../components/activities/AddActivityDialog'
import { Checkbox } from '../components/ui/checkbox'
import {
  useActivities,
  useCustomers,
  useDeals,
  useDeleteActivity,
  useToggleActivityCompleted,
} from '../hooks/useSupabaseQuery'
import { usePermissions } from '../contexts/PermissionsContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'
import { cn } from '../lib/utils'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  addMonths,
} from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Calendar, List, Pencil, Plus, Trash2 } from 'lucide-react'

type ActivityType = 'task' | 'meeting' | 'call' | 'email'

type ViewMode = 'list' | 'calendar'

const getTypeLabels = (t: (key: string) => string): Record<ActivityType, string> => ({
  task: t('activities.task'),
  meeting: t('activities.meeting'),
  call: t('activities.call'),
  email: t('activities.email'),
})

const typeBadge: Record<ActivityType, { variant: 'secondary' | 'default' | 'destructive' | 'outline'; className?: string }> = {
  task: {
    variant: 'outline',
    className: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  },
  meeting: {
    variant: 'outline',
    className: 'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20',
  },
  call: {
    variant: 'outline',
    className: 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
  },
  email: {
    variant: 'outline',
    className: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/20',
  },
}

function parseDueDate(due?: string | null) {
  if (!due) return null
  try {
    return parseISO(due)
  } catch {
    return null
  }
}

export function Activities() {
  const { t, i18n } = useTranslation()
  const [openAdd, setOpenAdd] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('list')

  const typeLabels = getTypeLabels(t)

  const activitiesQuery = useActivities()
  const customersQuery = useCustomers()
  const dealsQuery = useDeals()
  const toggleCompleted = useToggleActivityCompleted()
  const deleteActivity = useDeleteActivity()
  const { canEditModule } = usePermissions()
  const canEditActivities = canEditModule('activities')

  const activities = activitiesQuery.data ?? []
  const customers = customersQuery.data ?? []
  const deals = dealsQuery.data ?? []

  const customersById = useMemo(() => {
    const m = new Map<string, (typeof customers)[number]>()
    for (const c of customers) m.set(c.id, c)
    return m
  }, [customers])

  const dealsById = useMemo(() => {
    const m = new Map<string, (typeof deals)[number]>()
    for (const d of deals) m.set(d.id, d)
    return m
  }, [deals])

  const editingActivity = useMemo(() => {
    if (!editingActivityId) return undefined
    return activities.find((a) => a.id === editingActivityId)
  }, [activities, editingActivityId])

  const upcoming = useMemo(() => {
    return [...activities]
      .sort((a, b) => {
        const da = parseDueDate(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY
        const db = parseDueDate(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY
        return da - db
      })
  }, [activities])

  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const dateLocale = useMemo(() => (i18n.language?.startsWith('en') ? enUS : tr), [i18n.language])

  const monthLabel = useMemo(() => format(monthCursor, 'LLLL yyyy', { locale: dateLocale }), [monthCursor, dateLocale])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 })

    const days: Date[] = []
    let cur = start
    while (cur <= end) {
      days.push(cur)
      cur = addDays(cur, 1)
    }
    return days
  }, [monthCursor])

  const activitiesByDay = useMemo(() => {
    const m = new Map<string, typeof activities>()
    for (const a of activities) {
      const d = parseDueDate(a.due_date)
      if (!d) continue
      const key = format(d, 'yyyy-MM-dd')
      const arr = m.get(key)
      if (arr) arr.push(a)
      else m.set(key, [a])
    }
    return m
  }, [activities])

  const selectedDayActivities = useMemo(() => {
    const key = format(selectedDay, 'yyyy-MM-dd')
    return (activitiesByDay.get(key) ?? []).slice().sort((a, b) => {
      const da = parseDueDate(a.due_date)?.getTime() ?? 0
      const db = parseDueDate(b.due_date)?.getTime() ?? 0
      return da - db
    })
  }, [activitiesByDay, selectedDay])

  const isLoading = activitiesQuery.isLoading || customersQuery.isLoading || dealsQuery.isLoading

  const formatDateTime = (due?: string | null) => {
    const d = parseDueDate(due)
    if (!d) return '-'
    return `${format(d, 'd MMM yyyy', { locale: dateLocale })} - ${format(d, 'HH:mm', { locale: dateLocale })}`
  }

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, idx) => format(addDays(start, idx), 'EEE', { locale: dateLocale }))
  }, [dateLocale])

  const handleToggle = async (id: string, next: boolean) => {
    try {
      await toggleCompleted.mutateAsync({ id, is_completed: next })
    } catch (e: any) {
      toast({ title: t('common.updateFailed'), description: e?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteActivity.mutateAsync({ id })
      toast({ title: t('activities.activityDeleted') })
    } catch (e: any) {
      toast({ title: t('common.deleteFailed'), description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <AppLayout title={t('nav.activities')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                {t('activities.list')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                {t('activities.calendar')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={() => setOpenAdd(true)} className="gap-2" disabled={!canEditActivities}>
            <Plus className="h-4 w-4" />
            {t('activities.newActivity')}
          </Button>
        </div>

        <AddActivityDialog open={openAdd} onOpenChange={setOpenAdd} />
        <AddActivityDialog open={openEdit} onOpenChange={setOpenEdit} activity={editingActivity} />

        {view === 'list' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('activities.upcomingActivities')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : upcoming.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('activities.noActivities')}</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.done')}</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.subject')}</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.type')}</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.related')}</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('common.date')}</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((a) => {
                        const badge = typeBadge[a.type as ActivityType] ?? { variant: 'secondary' as const }
                        const customer = a.customer_id ? customersById.get(a.customer_id) : null
                        const deal = a.deal_id ? dealsById.get(a.deal_id) : null
                        const relatedText = deal?.title ?? customer?.name ?? '-'

                        return (
                          <tr key={a.id} className="border-b">
                            <td className="p-4">
                              <Checkbox
                                checked={Boolean(a.is_completed)}
                                onCheckedChange={(v: boolean | 'indeterminate') => void handleToggle(a.id, Boolean(v))}
                                disabled={!canEditActivities}
                              />
                            </td>
                            <td className={cn('p-4 font-medium', a.is_completed && 'line-through text-muted-foreground')}>
                              {a.subject}
                            </td>
                            <td className="p-4">
                              <Badge variant={badge.variant} className={badge.className}>
                                {typeLabels[a.type as ActivityType] ?? String(a.type)}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{relatedText}</td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {formatDateTime(a.due_date)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setEditingActivityId(a.id)
                                    setOpenEdit(true)
                                  }}
                                  disabled={!canEditActivities}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" disabled={!canEditActivities}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Aktivite silinsin mi?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bu işlem geri alınamaz.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>İptal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => void handleDelete(a.id)}>
                                        Sil
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{monthLabel}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMonthCursor((d) => subMonths(d, 1))}>
                    {t('common.previous')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
                    {t('common.today')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMonthCursor((d) => addMonths(d, 1))}>
                    {t('common.next')}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-7 gap-2">
                    {weekdayLabels.map((d) => (
                      <div key={d} className="text-xs font-medium text-muted-foreground px-1">
                        {d}
                      </div>
                    ))}

                    {calendarDays.map((day) => {
                      const key = format(day, 'yyyy-MM-dd')
                      const dayActivities = activitiesByDay.get(key) ?? []
                      const inMonth = isSameMonth(day, monthCursor)
                      const isSelected = isSameDay(day, selectedDay)

                      const completedCount = dayActivities.filter((x) => x.is_completed).length
                      const openCount = dayActivities.length - completedCount

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            'rounded-md border p-2 text-left min-h-[86px] transition-colors',
                            inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground',
                            isSelected && 'ring-2 ring-primary'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{format(day, 'd', { locale: dateLocale })}</div>
                            {dayActivities.length > 0 ? (
                              <div className="text-xs text-muted-foreground">{dayActivities.length}</div>
                            ) : null}
                          </div>

                          {dayActivities.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {openCount > 0 ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                              {completedCount > 0 ? <span className="h-2 w-2 rounded-full bg-muted-foreground" /> : null}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold">{format(selectedDay, 'd MMMM yyyy', { locale: dateLocale })}</div>
                      <Button variant="outline" size="sm" onClick={() => setOpenAdd(true)} disabled={!canEditActivities}>
                        {t('activities.newActivity')}
                      </Button>
                    </div>

                    {selectedDayActivities.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{t('activities.noActivitiesForDay')}</div>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.done')}</th>
                              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.subject')}</th>
                              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.type')}</th>
                              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('activities.related')}</th>
                              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('common.time')}</th>
                              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('table.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDayActivities.map((a) => {
                              const badge = typeBadge[a.type as ActivityType] ?? { variant: 'secondary' as const }
                              const customer = a.customer_id ? customersById.get(a.customer_id) : null
                              const deal = a.deal_id ? dealsById.get(a.deal_id) : null
                              const due = parseDueDate(a.due_date)
                              const relatedText = deal?.title ?? customer?.name ?? '-'

                              return (
                                <tr key={a.id} className="border-b">
                                  <td className="p-4">
                                    <Checkbox
                                      checked={Boolean(a.is_completed)}
                                      onCheckedChange={(v: boolean | 'indeterminate') => void handleToggle(a.id, Boolean(v))}
                                      disabled={!canEditActivities}
                                    />
                                  </td>
                                  <td className={cn('p-4 font-medium', a.is_completed && 'line-through text-muted-foreground')}>
                                    {a.subject}
                                  </td>
                                  <td className="p-4">
                                    <Badge variant={badge.variant} className={badge.className}>
                                      {typeLabels[a.type as ActivityType] ?? String(a.type)}
                                    </Badge>
                                  </td>
                                  <td className="p-4 text-sm text-muted-foreground">{relatedText}</td>
                                  <td className="p-4 text-sm text-muted-foreground">
                                    {due ? format(due, 'HH:mm', { locale: dateLocale }) : '-'}
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setEditingActivityId(a.id)
                                          setOpenEdit(true)
                                        }}
                                        disabled={!canEditActivities}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>

                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button type="button" variant="outline" size="icon" disabled={!canEditActivities}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Aktivite silinsin mi?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Bu işlem geri alınamaz.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => void handleDelete(a.id)}>
                                              Sil
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
