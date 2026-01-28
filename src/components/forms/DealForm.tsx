import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateDeal, useCustomers, useUpdateDeal } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'

const createDealSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('deals.form.validation.titleRequired')),
    customerId: z.string().min(1, t('deals.form.validation.customerRequired')),
    value: z.number().nonnegative(t('deals.form.validation.valueNonNegative')),
    stage: z.enum(['new', 'meeting', 'proposal', 'negotiation', 'won', 'lost']),
    expectedCloseDate: z.date(),
  })

type DealFormValues = z.infer<ReturnType<typeof createDealSchema>>

type DealRow = Database['public']['Tables']['deals']['Row']

type DealFormProps = {
  initialDeal?: DealRow
  onSuccess?: () => void
}

export function DealForm({ initialDeal, onSuccess }: DealFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()

  const dealSchema = useMemo(() => createDealSchema(t), [t])

  const isEditing = Boolean(initialDeal?.id)

  const defaultValues = useMemo<DealFormValues>(() => {
    if (isEditing && initialDeal) {
      return {
        title: initialDeal.title,
        customerId: initialDeal.customer_id,
        value: Number(initialDeal.value ?? 0),
        stage: initialDeal.stage,
        expectedCloseDate: new Date(initialDeal.expected_close_date),
      }
    }

    return {
      title: '',
      customerId: '',
      value: 0,
      stage: 'new',
      expectedCloseDate: new Date(),
    }
  }, [initialDeal, isEditing])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const onSubmit = async (values: DealFormValues) => {
    if (!user) return

    if (isEditing && initialDeal?.id) {
      await updateDeal.mutateAsync({
        id: initialDeal.id,
        patch: {
          title: values.title.trim(),
          customer_id: values.customerId,
          value: Number(values.value ?? 0),
          stage: values.stage,
          expected_close_date: format(values.expectedCloseDate, 'yyyy-MM-dd'),
        },
      })

      onSuccess?.()
      return
    }

    await createDeal.mutateAsync({
      user_id: user.id,
      customer_id: values.customerId,
      title: values.title.trim(),
      value: Number(values.value ?? 0),
      stage: values.stage,
      expected_close_date: format(values.expectedCloseDate, 'yyyy-MM-dd'),
    })

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="title">{t('deals.form.title')}</Label>
        <Input id="title" placeholder={t('deals.form.titlePlaceholder')} {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t('deals.form.customer')}</Label>
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('deals.form.selectCustomer')} />
              </SelectTrigger>
              <SelectContent>
                {(customersQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="value">{t('deals.form.value')}</Label>
          <Input id="value" type="number" step="0.01" {...register('value', { valueAsNumber: true })} />
          {errors.value && <p className="text-sm text-destructive">{errors.value.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('deals.form.stage')}</Label>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('deals.form.stagePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t('deals.newOpportunity')}</SelectItem>
                  <SelectItem value="meeting">{t('deals.meeting')}</SelectItem>
                  <SelectItem value="proposal">{t('deals.proposal')}</SelectItem>
                  <SelectItem value="negotiation">{t('deals.negotiation')}</SelectItem>
                  <SelectItem value="won">{t('deals.won')}</SelectItem>
                  <SelectItem value="lost">{t('deals.lost')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Controller
        control={control}
        name="expectedCloseDate"
        render={({ field }) => (
          <UnifiedDatePicker
            label={t('deals.form.expectedCloseDate')}
            value={field.value}
            onChange={(d) => field.onChange(d ?? new Date())}
          />
        )}
      />

      {(createDeal.error || updateDeal.error) && (
        <p className="text-sm text-destructive">
          {((createDeal.error || updateDeal.error) as any)?.message ||
            (isEditing ? t('deals.form.updateFailed') : t('deals.form.createFailed'))}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={createDeal.isPending || updateDeal.isPending || !user}>
          {t('deals.form.submit')}
        </Button>
      </div>
    </form>
  )
}
