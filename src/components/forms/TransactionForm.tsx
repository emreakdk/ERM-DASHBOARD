import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { format } from 'date-fns'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateTransaction, useCustomers, useUpdateTransaction } from '../../hooks/useSupabaseQuery'
import { TRANSACTION_CATEGORIES } from '../../lib/constants'
import { AccountSelector } from '../shared/AccountSelector'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import type { Database } from '../../types/database'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Tutar 0’dan büyük olmalı'),
  date: z.date(),
  accountId: z.string().min(1, 'Hesap seçimi zorunludur'),
  category: z.string().min(1, 'Kategori zorunludur'),
  customerId: z.string().optional(),
  description: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

type TransactionFormProps = {
  initialTransaction?: Database['public']['Tables']['transactions']['Row']
  onSuccess?: () => void
}

export function TransactionForm({ initialTransaction, onSuccess }: TransactionFormProps) {
  const { user } = useAuth()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const customersQuery = useCustomers()

  const isEditing = Boolean(initialTransaction?.id)

  const [kind, setKind] = useState<'income' | 'expense'>(
    initialTransaction?.type ?? 'income'
  )

  const defaultValues = useMemo<TransactionFormValues>(
    () => {
      const initialType = initialTransaction?.type ?? 'income'
      const date = initialTransaction?.transaction_date
        ? new Date(initialTransaction.transaction_date)
        : new Date()

      return {
        type: initialType,
        amount: Number(initialTransaction?.amount ?? 0),
        date,
        accountId: initialTransaction?.bank_account ?? '',
        category:
          initialTransaction?.category ??
          (initialType === 'income'
            ? (TRANSACTION_CATEGORIES.INCOME[0] ?? 'Satış Geliri')
            : (TRANSACTION_CATEGORIES.EXPENSE[0] ?? 'Maaş')),
        customerId: initialTransaction?.customer_id ?? undefined,
        description: initialTransaction?.description ?? '',
      }
    },
    [initialTransaction]
  )

  const {
    register,
    control,
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
    setKind(defaultValues.type)
  }, [defaultValues, reset])

  const type = watch('type')
  const categories = type === 'income' ? TRANSACTION_CATEGORIES.INCOME : TRANSACTION_CATEGORIES.EXPENSE

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user) return

    if (isEditing && initialTransaction?.id) {
      await updateTransaction.mutateAsync({
        id: initialTransaction.id,
        patch: {
          type: values.type,
          amount: values.amount,
          category: values.category,
          description: values.description?.trim() || null,
          transaction_date: format(values.date, 'yyyy-MM-dd'),
          customer_id: values.customerId || null,
          bank_account: values.accountId,
        },
      })
    } else {
      await createTransaction.mutateAsync({
        user_id: user.id,
        type: values.type,
        amount: values.amount,
        category: values.category,
        description: values.description?.trim() || null,
        transaction_date: format(values.date, 'yyyy-MM-dd'),
        customer_id: values.customerId || null,
        // NOTE: mevcut şemada account_id yok; account seçimini bank_account alanına id olarak yazıyoruz.
        bank_account: values.accountId,
      })
    }

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={kind === 'income' ? 'default' : 'outline'}
          className={kind === 'income' ? '' : 'text-muted-foreground'}
          onClick={() => {
            setKind('income')
            setValue('type', 'income')
            setValue('category', TRANSACTION_CATEGORIES.INCOME[0] ?? 'Satış Geliri')
          }}
        >
          Gelir
        </Button>
        <Button
          type="button"
          variant={kind === 'expense' ? 'destructive' : 'outline'}
          className={kind === 'expense' ? '' : 'text-muted-foreground'}
          onClick={() => {
            setKind('expense')
            setValue('type', 'expense')
            setValue('category', TRANSACTION_CATEGORIES.EXPENSE[0] ?? 'Maaş')
          }}
        >
          Gider
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Tutar</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <UnifiedDatePicker
              label="Tarih"
              value={field.value}
              onChange={(d) => field.onChange(d ?? new Date())}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name="accountId"
        render={({ field }) => (
          <AccountSelector
            label="Hesap"
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {errors.accountId && (
        <p className="text-sm text-destructive">{errors.accountId.message}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seç" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Müşteri (Opsiyonel)</Label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Select
                value={field.value ?? '__none__'}
                onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Yok</SelectItem>
                  {(customersQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea id="description" placeholder="Not ekleyin..." {...register('description')} />
      </div>

      {createTransaction.error && (
        <p className="text-sm text-destructive">
          {(createTransaction.error as any)?.message || 'İşlem oluşturulamadı'}
        </p>
      )}

      {updateTransaction.error && (
        <p className="text-sm text-destructive">
          {(updateTransaction.error as any)?.message || 'İşlem güncellenemedi'}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createTransaction.isPending || updateTransaction.isPending || !user}
        >
          Kaydet
        </Button>
      </div>
    </form>
  )
}
