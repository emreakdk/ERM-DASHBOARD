import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../contexts/AuthContext'
import {
  useCategories,
  useCreateTransaction,
  useCustomers,
  useUpdateTransaction,
} from '../../hooks/useSupabaseQuery'
import { AccountSelector } from '../shared/AccountSelector'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { Database } from '../../types/database'

const createTransactionSchema = (t: (key: string) => string) =>
  z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive(t('finance.form.validation.amountPositive')),
    date: z.date(),
    accountId: z.string().min(1, t('finance.form.validation.accountRequired')),
    category: z.string().min(1, t('finance.form.validation.categoryRequired')),
    payee: z.string().optional(),
    customerId: z.string().optional(),
    description: z.string().optional(),
  })

type TransactionFormValues = z.infer<ReturnType<typeof createTransactionSchema>>

type TransactionFormProps = {
  initialTransaction?: Database['public']['Tables']['transactions']['Row']
  onSuccess?: () => void
}

export function TransactionForm({ initialTransaction, onSuccess }: TransactionFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const customersQuery = useCustomers()

  const transactionSchema = useMemo(() => createTransactionSchema(t), [t])

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
        category: initialTransaction?.category ?? '',
        payee: initialTransaction?.payee ?? '',
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
  const selectedCategory = watch('category')
  const categoriesQuery = useCategories(type)
  const categories = useMemo(() => {
    return (categoriesQuery.data ?? []).map((c) => c.name)
  }, [categoriesQuery.data])

  useEffect(() => {
    if (isEditing) return
    if (selectedCategory && categories.includes(selectedCategory)) return
    if (categories.length > 0) {
      setValue('category', categories[0] ?? '')
    }
  }, [categories, isEditing, selectedCategory, setValue])

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user) return

    const payee = values.type === 'expense' ? values.payee?.trim() || null : null

    if (isEditing && initialTransaction?.id) {
      await updateTransaction.mutateAsync({
        id: initialTransaction.id,
        patch: {
          type: values.type,
          amount: values.amount,
          category: values.category,
          payee,
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
        payee,
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
            if (type !== 'income') {
              setValue('category', '')
            }
          }}
        >
          {t('finance.form.income')}
        </Button>
        <Button
          type="button"
          variant={kind === 'expense' ? 'destructive' : 'outline'}
          className={kind === 'expense' ? '' : 'text-muted-foreground'}
          onClick={() => {
            setKind('expense')
            setValue('type', 'expense')
            if (type !== 'expense') {
              setValue('category', '')
            }
          }}
        >
          {t('finance.form.expense')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">{t('finance.form.amount')}</Label>
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
              label={t('finance.form.date')}
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
            label={t('finance.form.account')}
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
          <Label>{t('finance.form.category')}</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('finance.form.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {t('finance.form.categoryEmpty')}
                    </SelectItem>
                  ) : (
                    categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t('finance.form.customerOptional')}</Label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Select
                value={field.value ?? '__none__'}
                onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('finance.form.customerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('finance.form.none')}</SelectItem>
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

      {type === 'expense' ? (
        <div className="space-y-2">
          <Label htmlFor="payee">{t('finance.form.payee')}</Label>
          <Input id="payee" placeholder={t('finance.form.payeePlaceholder')} {...register('payee')} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="description">{t('finance.form.description')}</Label>
        <Textarea id="description" placeholder={t('finance.form.descriptionPlaceholder')} {...register('description')} />
      </div>

      {createTransaction.error && (
        <p className="text-sm text-destructive">
          {(createTransaction.error as any)?.message || t('finance.form.createFailed')}
        </p>
      )}

      {updateTransaction.error && (
        <p className="text-sm text-destructive">
          {(updateTransaction.error as any)?.message || t('finance.form.updateFailed')}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createTransaction.isPending || updateTransaction.isPending || !user}
        >
          {t('finance.form.submit')}
        </Button>
      </div>
    </form>
  )
}
