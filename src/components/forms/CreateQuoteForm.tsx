import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../contexts/AuthContext'
import {
  useCreateQuote,
  useCustomers,
  useProducts,
  useQuoteItems,
  useUpdateQuote,
} from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'

const createQuoteItemSchema = (t: any) => z.object({
  productId: z.string().optional(),
  description: z.string().min(1, t('quotes.form.validation.productRequired')),
  quantity: z.number().positive(t('quotes.form.validation.quantityPositive')),
  unitPrice: z.number().nonnegative(t('quotes.form.validation.priceNonNegative')),
})

const createQuoteSchema = (t: any) => z.object({
  customerId: z.string().min(1, t('quotes.form.validation.customerRequired')),
  quoteNumber: z.string().min(1, t('quotes.form.validation.quoteNumberRequired')),
  issueDate: z.date(),
  expiryDate: z.date(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'converted']),
  taxRate: z.number().nonnegative(),
  taxInclusive: z.boolean(),
  notes: z.string().optional(),
  items: z.array(createQuoteItemSchema(t)).min(1, t('quotes.form.validation.minOneItem')),
})

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

type CreateQuoteFormProps = {
  initialQuote?: QuoteRow
  onSuccess?: () => void
}

function createDefaultQuoteNumber() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `QT-${yyyy}${rand}`
}

function productLabel(p: ProductRow) {
  const sku = p.sku ? ` (${p.sku})` : ''
  return `${p.name}${sku}`
}

export function CreateQuoteForm({ initialQuote, onSuccess }: CreateQuoteFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const productsQuery = useProducts()
  
  const quoteSchema = useMemo(() => createQuoteSchema(t), [t])
  type CreateQuoteValues = z.infer<typeof quoteSchema>

  const quoteItemsQuery = useQuoteItems(initialQuote?.id)

  const createQuote = useCreateQuote()
  const updateQuote = useUpdateQuote()

  const isEditing = Boolean(initialQuote?.id)

  const [productPickerOpenByIndex, setProductPickerOpenByIndex] = useState<Record<number, boolean>>({})
  const [productPickerQueryByIndex, setProductPickerQueryByIndex] = useState<Record<number, string>>({})

  const defaultValues = useMemo<CreateQuoteValues>(() => {
    if (isEditing && initialQuote) {
      const items: CreateQuoteValues['items'] = (quoteItemsQuery.data ?? []).length
        ? (quoteItemsQuery.data ?? []).map((it) => ({
            productId: it.product_id ?? undefined,
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
          }))
        : [{ productId: undefined, description: '', quantity: 1, unitPrice: 0 }]

      return {
        customerId: initialQuote.customer_id,
        quoteNumber: initialQuote.quote_number,
        issueDate: new Date(initialQuote.issue_date),
        expiryDate: new Date(initialQuote.expiry_date),
        status: initialQuote.status,
        taxRate: Number(initialQuote.tax_rate ?? 0),
        taxInclusive: false,
        notes: initialQuote.notes ?? '',
        items,
      }
    }

    return {
      customerId: '',
      quoteNumber: createDefaultQuoteNumber(),
      issueDate: new Date(),
      expiryDate: new Date(),
      status: 'draft',
      taxRate: 20,
      taxInclusive: false,
      notes: '',
      items: [{ productId: undefined, description: '', quantity: 1, unitPrice: 0 }],
    }
  }, [initialQuote, isEditing, quoteItemsQuery.data])

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateQuoteValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const items = watch('items')
  const taxRate = watch('taxRate')

  const productsById = useMemo(() => {
    return new Map((productsQuery.data ?? []).map((p) => [p.id, p]))
  }, [productsQuery.data])

  const subtotal = (items ?? []).reduce(
    (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  )
  const taxAmount = subtotal * (Number(taxRate || 0) / 100)
  const totalAmount = subtotal + taxAmount

  const onSubmit = async (values: CreateQuoteValues) => {
    if (!user) return

    const nextSubtotal = (values.items ?? []).reduce(
      (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
      0
    )
    const nextTaxAmount = nextSubtotal * (Number(values.taxRate || 0) / 100)
    const nextTotalAmount = nextSubtotal + nextTaxAmount

    const mappedItems: Array<Omit<Database['public']['Tables']['quote_items']['Insert'], 'quote_id'>> =
      values.items.map((it) => ({
        product_id: it.productId?.trim() ? it.productId.trim() : null,
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unitPrice),
        amount: Number(it.quantity) * Number(it.unitPrice),
      }))

    if (isEditing && initialQuote?.id) {
      await updateQuote.mutateAsync({
        id: initialQuote.id,
        quote: {
          customer_id: values.customerId,
          quote_number: values.quoteNumber,
          issue_date: format(values.issueDate, 'yyyy-MM-dd'),
          expiry_date: format(values.expiryDate, 'yyyy-MM-dd'),
          status: values.status,
          subtotal: nextSubtotal,
          tax_rate: Number(values.taxRate || 0),
          tax_amount: nextTaxAmount,
          total_amount: nextTotalAmount,
          notes: values.notes?.trim() || null,
        },
        items: mappedItems,
      })

      onSuccess?.()
      return
    }

    await createQuote.mutateAsync({
      quote: {
        user_id: user.id,
        customer_id: values.customerId,
        quote_number: values.quoteNumber,
        issue_date: format(values.issueDate, 'yyyy-MM-dd'),
        expiry_date: format(values.expiryDate, 'yyyy-MM-dd'),
        status: values.status,
        subtotal: nextSubtotal,
        tax_rate: Number(values.taxRate || 0),
        tax_amount: nextTaxAmount,
        total_amount: nextTotalAmount,
        notes: values.notes?.trim() || null,
      },
      items: mappedItems,
    })

    onSuccess?.()
  }

  const renderProductCombobox = (index: number) => {
    const row = items?.[index]
    const selectedProductId = row?.productId
    const selectedProduct = selectedProductId ? productsById.get(selectedProductId) : undefined

    const query = productPickerQueryByIndex[index] ?? ''
    const filtered = (productsQuery.data ?? []).filter((p) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return productLabel(p).toLowerCase().includes(q)
    })

    const open = Boolean(productPickerOpenByIndex[index])

    return (
      <Popover
        open={open}
        onOpenChange={(v) => setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: v }))}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', !selectedProduct && 'text-muted-foreground')}
            disabled={productsQuery.isLoading || productsQuery.isError}
          >
            <span className="truncate">
              {selectedProduct
                ? productLabel(selectedProduct)
                : productsQuery.isLoading
                  ? t('quotes.form.loading')
                  : t('quotes.form.selectProduct')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <Command
            value={query}
            onValueChange={(v) => setProductPickerQueryByIndex((prev) => ({ ...prev, [index]: v }))}
          >
            <CommandInput placeholder={t('quotes.form.searchProduct')} />
            <CommandList>
              {filtered.length === 0 ? <CommandEmpty>{t('quotes.form.noResults')}</CommandEmpty> : null}
              <CommandGroup>
                <CommandItem
                  selected={!selectedProductId}
                  onClick={() => {
                    setValue(`items.${index}.productId`, undefined)
                    setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: false }))
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('h-4 w-4', !selectedProductId ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{t('quotes.form.customItem')}</span>
                </CommandItem>

                {filtered.map((p) => {
                  const isSelected = p.id === selectedProductId
                  return (
                    <CommandItem
                      key={p.id}
                      selected={isSelected}
                      onClick={() => {
                        setValue(`items.${index}.productId`, p.id)
                        setValue(`items.${index}.description`, p.description ?? p.name)
                        setValue(`items.${index}.unitPrice`, Number(p.unit_price ?? 0))
                        setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: false }))
                      }}
                      className="flex items-center gap-2"
                    >
                      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{productLabel(p)}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('quotes.form.customer')}</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quotes.form.selectCustomer')} />
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

          <div className="space-y-2">
            <Label htmlFor="quoteNumber">{t('quotes.form.quoteNumber')}</Label>
            <Input id="quoteNumber" {...register('quoteNumber')} />
            {errors.quoteNumber && <p className="text-sm text-destructive">{errors.quoteNumber.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Controller
            control={control}
            name="issueDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label={t('quotes.form.issueDate')}
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
          <Controller
            control={control}
            name="expiryDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label={t('quotes.form.expiryDate')}
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
          <div className="space-y-2">
            <Label>{t('quotes.form.status')}</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quotes.form.statusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('quotes.draft')}</SelectItem>
                    <SelectItem value="sent">{t('quotes.sent')}</SelectItem>
                    <SelectItem value="accepted">{t('quotes.accepted')}</SelectItem>
                    <SelectItem value="rejected">{t('quotes.rejected')}</SelectItem>
                    <SelectItem value="converted">{t('quotes.converted')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('quotes.form.itemsSection')}</h3>
          <Button type="button" variant="outline" onClick={() => append({ productId: undefined, description: '', quantity: 1, unitPrice: 0 })}>
            <Plus className="mr-2 h-4 w-4" />
            {t('quotes.form.addItem')}
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const row = items?.[index]
            const rowTotal = Number(row?.quantity || 0) * Number(row?.unitPrice || 0)

            return (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-4 space-y-2">
                    <Label>{t('quotes.form.product')}</Label>
                    {renderProductCombobox(index)}
                  </div>

                  <div className="md:col-span-4 space-y-2">
                    <Label>{t('quotes.form.description')}</Label>
                    <Input placeholder={t('quotes.form.descriptionPlaceholder')} {...register(`items.${index}.description` as const)} />
                    {errors.items?.[index]?.description && (
                      <p className="text-sm text-destructive">{errors.items[index]?.description?.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>{t('quotes.form.quantity')}</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>{t('quotes.form.unitPrice')}</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                  </div>

                  <div className="md:col-span-12 flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">{t('quotes.form.lineTotal')}: <span className="font-medium text-foreground">₺{rowTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span></div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('quotes.form.remove')}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {typeof errors.items?.message === 'string' ? (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        ) : null}
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="taxRate">{t('quotes.form.taxRate')}</Label>
            <Input id="taxRate" type="number" step="0.01" {...register('taxRate', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t('quotes.form.notes')}</Label>
            <Textarea id="notes" placeholder={t('quotes.form.optional')} {...register('notes')} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('quotes.form.subtotal')}</span>
            <span className="font-medium">₺{subtotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('quotes.form.vat')}</span>
            <span className="font-medium">₺{taxAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t('quotes.form.grandTotal')}</span>
            <span className="text-lg font-bold">₺{totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {(createQuote.error || updateQuote.error) && (
        <p className="text-sm text-destructive">
          {((createQuote.error || updateQuote.error) as any)?.message ||
            (isEditing ? t('quotes.form.updateFailed') : t('quotes.form.createFailed'))}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={createQuote.isPending || updateQuote.isPending || !user}>
          {isEditing ? t('quotes.form.updateQuote') : t('quotes.form.createQuote')}
        </Button>
      </div>
    </form>
  )
}
