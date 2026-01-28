import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateAccount, useUpdateAccount } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { useTranslation } from 'react-i18next'

const createAccountSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('accounts.form.validation.nameRequired')),
    type: z.enum(['bank', 'cash', 'credit_card']),
    currency: z.enum(['TRY', 'USD', 'EUR']),
    balance: z.number({ invalid_type_error: t('accounts.form.validation.balanceNumber') }),
  })

type AccountFormValues = z.infer<ReturnType<typeof createAccountSchema>>

type AccountFormProps = {
  initialAccount?: Database['public']['Tables']['accounts']['Row']
  onSuccess?: () => void
}

const accountTypeOptions = [
  { value: 'bank' as const, labelKey: 'accounts.bank' },
  { value: 'cash' as const, labelKey: 'accounts.cash' },
  { value: 'credit_card' as const, labelKey: 'accounts.creditCard' },
]

const currencyOptions = [
  { value: 'TRY' as const, label: 'TRY (₺)' },
  { value: 'USD' as const, label: 'USD ($)' },
  { value: 'EUR' as const, label: 'EUR (€)' },
]

export function AccountForm({ initialAccount, onSuccess }: AccountFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()

  const accountSchema = useMemo(() => createAccountSchema(t), [t])
  const isEditing = Boolean(initialAccount?.id)

  const defaultValues = useMemo<AccountFormValues>(
    () => ({
      name: initialAccount?.name ?? '',
      type: initialAccount?.type ?? 'bank',
      currency: initialAccount?.currency ?? 'TRY',
      balance: Number(initialAccount?.balance ?? 0),
    }),
    [initialAccount]
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const onSubmit = async (values: AccountFormValues) => {
    if (!user) return

    if (isEditing && initialAccount?.id) {
      await updateAccount.mutateAsync({
        id: initialAccount.id,
        patch: {
          name: values.name,
          type: values.type,
          currency: values.currency,
          balance: values.balance,
        },
      })
    } else {
      await createAccount.mutateAsync({
        user_id: user.id,
        name: values.name,
        type: values.type,
        currency: values.currency,
        balance: values.balance,
      })
    }

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">{t('accounts.form.name')}</Label>
        <Input id="name" placeholder={t('accounts.form.namePlaceholder')} {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('accounts.form.type')}</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t('accounts.form.currency')}</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.currency && (
            <p className="text-sm text-destructive">{errors.currency.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="balance">{t('accounts.form.balance')}</Label>
        <Input
          id="balance"
          type="number"
          step="0.01"
          inputMode="decimal"
          {...register('balance', { valueAsNumber: true })}
        />
        {errors.balance && (
          <p className="text-sm text-destructive">{errors.balance.message}</p>
        )}
      </div>

      {(createAccount.error || updateAccount.error) && (
        <p className="text-sm text-destructive">
          {((createAccount.error || updateAccount.error) as any)?.message ||
            (isEditing ? t('accounts.form.updateFailed') : t('accounts.form.createFailed'))}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={createAccount.isPending || updateAccount.isPending || !user}
        >
          {t('accounts.form.submit')}
        </Button>
      </div>
    </form>
  )
}
