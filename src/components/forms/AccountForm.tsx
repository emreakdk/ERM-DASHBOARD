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

const accountSchema = z.object({
  name: z.string().min(1, 'Hesap adı zorunludur'),
  type: z.enum(['bank', 'cash', 'credit_card']),
  currency: z.enum(['TRY', 'USD', 'EUR']),
  balance: z.number().finite(),
})

type AccountFormValues = z.infer<typeof accountSchema>

type AccountFormProps = {
  initialAccount?: Database['public']['Tables']['accounts']['Row']
  onSuccess?: () => void
}

const accountTypeOptions = [
  { value: 'bank' as const, label: 'Banka' },
  { value: 'cash' as const, label: 'Kasa' },
  { value: 'credit_card' as const, label: 'Kredi Kartı' },
]

const currencyOptions = [
  { value: 'TRY' as const, label: 'TRY (₺)' },
  { value: 'USD' as const, label: 'USD ($)' },
  { value: 'EUR' as const, label: 'EUR (€)' },
]

export function AccountForm({ initialAccount, onSuccess }: AccountFormProps) {
  const { user } = useAuth()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()

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
        <Label htmlFor="name">Hesap Adı</Label>
        <Input id="name" placeholder="İş Bankası, Ofis Kasa..." {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tür</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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
          <Label>Para Birimi</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
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
        <Label htmlFor="balance">Başlangıç Bakiyesi</Label>
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
            (isEditing ? 'Hesap güncellenemedi' : 'Hesap oluşturulamadı')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={createAccount.isPending || updateAccount.isPending || !user}
        >
          Kaydet
        </Button>
      </div>
    </form>
  )
}
