import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCustomers, useDeals, useCreateActivity, useUpdateActivity } from '../../hooks/useSupabaseQuery'
import { useAuth } from '../../contexts/AuthContext'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { toast } from '../ui/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Calendar } from '../ui/calendar'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import type { Database } from '../../types/database'

type ActivityType = 'task' | 'meeting' | 'call' | 'email'

type AddActivityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCustomerId?: string
  activity?: Database['public']['Tables']['activities']['Row']
}

const getTypeLabels = (t: (key: string) => string): Record<ActivityType, string> => ({
  task: t('activities.task'),
  meeting: t('activities.meeting'),
  call: t('activities.call'),
  email: t('activities.email'),
})

export function AddActivityDialog({ open, onOpenChange, defaultCustomerId, activity }: AddActivityDialogProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const dealsQuery = useDeals()
  const createActivity = useCreateActivity()
  const updateActivity = useUpdateActivity()

  const isEdit = Boolean(activity?.id)
  const typeLabels = useMemo(() => getTypeLabels(t), [t])
  const dateLocale = i18n.language?.startsWith('en') ? enUS : tr

  const [subject, setSubject] = useState('')
  const [type, setType] = useState<ActivityType>('task')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [dueTime, setDueTime] = useState<string>('')
  const [customerId, setCustomerId] = useState<string | undefined>(defaultCustomerId)
  const [dealId, setDealId] = useState<string | undefined>(undefined)

  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [dealOpen, setDealOpen] = useState(false)
  const [dealQuery, setDealQuery] = useState('')

  const customers = customersQuery.data ?? []
  const deals = dealsQuery.data ?? []

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId])

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => (c.name ?? '').toLowerCase().includes(q))
  }, [customers, customerQuery])

  const dealsForCustomer = useMemo(() => {
    if (!customerId) return deals
    return deals.filter((d) => d.customer_id === customerId)
  }, [deals, customerId])

  const selectedDeal = useMemo(() => dealsForCustomer.find((d) => d.id === dealId) ?? null, [dealsForCustomer, dealId])

  const filteredDeals = useMemo(() => {
    const q = dealQuery.trim().toLowerCase()
    if (!q) return dealsForCustomer
    return dealsForCustomer.filter((d) => (d.title ?? '').toLowerCase().includes(q))
  }, [dealsForCustomer, dealQuery])

  const canSubmit =
    subject.trim().length > 0 &&
    Boolean(user?.id) &&
    !createActivity.isPending &&
    !updateActivity.isPending

  const getDefaultTime = () => {
    const now = new Date()
    const mins = now.getMinutes()
    const rounded = Math.round(mins / 30) * 30
    now.setMinutes(rounded, 0, 0)
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const combineDateAndTimeToIso = (d?: Date, t?: string) => {
    if (!d) return null
    const time = (t && /^\d{2}:\d{2}$/.test(t) ? t : '00:00') as string
    const [hh, mm] = time.split(':').map((x) => Number(x))
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0)
    return local.toISOString()
  }

  const reset = () => {
    setSubject('')
    setType('task')
    setDescription('')
    setDueDate(undefined)
    setDueTime('')
    setCustomerId(defaultCustomerId)
    setDealId(undefined)
    setCustomerQuery('')
    setDealQuery('')
    setCustomerOpen(false)
    setDealOpen(false)
  }

  useEffect(() => {
    if (!open) return

    if (activity) {
      setSubject(activity.subject ?? '')
      setType((activity.type as ActivityType) ?? 'task')
      setDescription(activity.description ?? '')
      setCustomerId(activity.customer_id ?? defaultCustomerId)
      setDealId(activity.deal_id ?? undefined)

      if (activity.due_date) {
        const d = new Date(activity.due_date)
        setDueDate(d)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setDueTime(`${hh}:${mm}`)
      } else {
        setDueDate(undefined)
        setDueTime('')
      }

      return
    }

    setCustomerId(defaultCustomerId)
  }, [open, activity, defaultCustomerId])

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  const handleSubmit = async () => {
    if (!user?.id) return
    const cleanSubject = subject.trim()
    if (!cleanSubject) return

    const dueIso = combineDateAndTimeToIso(dueDate, dueTime)

    try {
      if (activity?.id) {
        await updateActivity.mutateAsync({
          id: activity.id,
          patch: {
            customer_id: customerId ?? null,
            deal_id: dealId ?? null,
            type,
            subject: cleanSubject,
            description: description.trim() ? description.trim() : null,
            due_date: dueIso,
          },
        })

        toast({ title: t('activities.activityUpdated') })
      } else {
        await createActivity.mutateAsync({
          user_id: user.id,
          customer_id: customerId ?? null,
          deal_id: dealId ?? null,
          type,
          subject: cleanSubject,
          description: description.trim() ? description.trim() : null,
          due_date: dueIso,
          is_completed: false,
        })

        toast({ title: t('activities.activityAdded') })
      }

      handleClose(false)
    } catch (e: any) {
      toast({
        title: t(isEdit ? 'activities.activityUpdateFailed' : 'activities.activityAddFailed'),
        description: e?.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? 'activities.editActivity' : 'activities.newActivity')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="activity-subject">{t('activities.subject')}</Label>
            <Input
              id="activity-subject"
              placeholder={t('activities.subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('activities.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue placeholder={t('activities.selectType')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('activities.customerLabel')}</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className={cn('w-full justify-between', !selectedCustomer && 'text-muted-foreground')}
                  disabled={customersQuery.isLoading || customersQuery.isError}
                >
                  <span className="truncate">
                    {selectedCustomer
                      ? selectedCustomer.name
                      : customersQuery.isLoading
                        ? t('common.loading')
                        : t('activities.selectCustomer')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                <Command value={customerQuery} onValueChange={setCustomerQuery}>
                  <CommandInput placeholder={t('activities.searchCustomerPlaceholder')} />
                  <CommandList>
                    {filteredCustomers.length === 0 ? <CommandEmpty>{t('common.noResults')}</CommandEmpty> : null}
                    <CommandGroup>
                      <CommandItem
                        selected={!customerId}
                        onClick={() => {
                          setCustomerId(undefined)
                          setDealId(undefined)
                          setCustomerOpen(false)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check className={cn('h-4 w-4', !customerId ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{t('common.notSelected')}</span>
                      </CommandItem>
                      {filteredCustomers.map((c) => {
                        const isSelected = c.id === customerId
                        return (
                          <CommandItem
                            key={c.id}
                            selected={isSelected}
                            onClick={() => {
                              setCustomerId(c.id)
                              setDealId(undefined)
                              setCustomerOpen(false)
                            }}
                            className="flex items-center gap-2"
                          >
                            <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{c.name}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('common.date')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'd MMMM yyyy', { locale: dateLocale }) : t('activities.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar
                  selected={dueDate}
                  onSelect={(d) => {
                    setDueDate(d)
                    if (d && !dueTime) setDueTime(getDefaultTime())
                  }}
                  locale={dateLocale}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-time">{t('common.time')}</Label>
            <Input id="activity-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="activity-desc">{t('common.description')}</Label>
            <textarea
              id="activity-desc"
              className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('activities.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{t('activities.dealOptional')}</Label>
            <Popover open={dealOpen} onOpenChange={setDealOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={dealOpen}
                  className={cn('w-full justify-between', !selectedDeal && 'text-muted-foreground')}
                  disabled={dealsQuery.isLoading || dealsQuery.isError}
                >
                  <span className="truncate">
                    {selectedDeal
                      ? selectedDeal.title
                      : dealsQuery.isLoading
                        ? t('common.loading')
                        : t('activities.selectDeal')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                <Command value={dealQuery} onValueChange={setDealQuery}>
                  <CommandInput placeholder={t('activities.searchDealPlaceholder')} />
                  <CommandList>
                    {filteredDeals.length === 0 ? <CommandEmpty>{t('common.noResults')}</CommandEmpty> : null}
                    <CommandGroup>
                      <CommandItem
                        selected={!dealId}
                        onClick={() => {
                          setDealId(undefined)
                          setDealOpen(false)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check className={cn('h-4 w-4', !dealId ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{t('common.notSelected')}</span>
                      </CommandItem>
                      {filteredDeals.map((d) => {
                        const isSelected = d.id === dealId
                        return (
                          <CommandItem
                            key={d.id}
                            selected={isSelected}
                            onClick={() => {
                              setDealId(d.id)
                              setDealOpen(false)
                            }}
                            className="flex items-center gap-2"
                          >
                            <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{d.title}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {t(isEdit ? 'common.update' : 'common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
