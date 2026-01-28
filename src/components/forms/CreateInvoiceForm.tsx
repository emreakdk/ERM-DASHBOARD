import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Trash2, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateInvoice, useCustomers, useUpdateInvoice, useProducts } from '../../hooks/useSupabaseQuery'
import { useQuotaGuard } from '../../hooks/useQuotaGuard'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { UpgradeRequiredModal } from '../modals/UpgradeRequiredModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'
import { cn } from '../../lib/utils'

const createInvoiceItemSchema = (t: any) => z.object({
  productId: z.string().optional(),
  description: z.string().min(1, t('invoices.form.validation.productRequired')),
  quantity: z.number().positive(t('invoices.form.validation.quantityPositive')),
  unitPrice: z.number().nonnegative(t('invoices.form.validation.priceNonNegative')),
  taxRate: z.number().min(0).max(100, t('invoices.form.validation.taxRateRange')),
})

const createInvoiceSchema = (t: any) => z.object({
  customerId: z.string().min(1, t('invoices.form.validation.customerRequired')),
  invoiceDate: z.date(),
  dueDate: z.date(),
  invoiceNumber: z.string().min(1, t('invoices.form.validation.invoiceNumberRequired')),
  taxInclusive: z.boolean(),
  notes: z.string().optional(),
  items: z.array(createInvoiceItemSchema(t)).min(1, t('invoices.form.validation.minOneItem')),
})

type InvoicePrefill = {
  customerId?: string
  taxRate?: number
  notes?: string
  items?: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>
}

type CreateInvoiceFormProps = {
  initialInvoice?: Database['public']['Tables']['invoices']['Row']
  initialItems?: Database['public']['Tables']['invoice_items']['Row'][]
  prefill?: InvoicePrefill
  onSuccess?: () => void
}

function createDefaultInvoiceNumber() {
  const now = new Date()
  return `INV-${format(now, 'yyyyMMdd')}-${Math.floor(Math.random() * 9000 + 1000)}`
}

export function CreateInvoiceForm({ initialInvoice, initialItems, prefill, onSuccess }: CreateInvoiceFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const productsQuery = useProducts()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const { canPerformAction } = useQuotaGuard()
  
  const invoiceSchema = useMemo(() => createInvoiceSchema(t), [t])
  type CreateInvoiceValues = z.infer<typeof invoiceSchema>

  const [openProductPicker, setOpenProductPicker] = useState<number | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean
    reason?: string
    message?: string
    current?: number
    limit?: number
  }>({ open: false })

  const isEditing = Boolean(initialInvoice?.id)
  const products = productsQuery.data ?? []

  const defaultValues = useMemo<CreateInvoiceValues>(() => {
    if (isEditing && initialInvoice) {
      return {
        customerId: initialInvoice.customer_id,
        invoiceDate: new Date(initialInvoice.invoice_date),
        dueDate: new Date(initialInvoice.due_date),
        invoiceNumber: initialInvoice.invoice_number,
        taxInclusive: false,
        notes: initialInvoice.notes ?? '',
        items:
          (initialItems ?? []).length > 0
            ? (initialItems ?? []).map((it) => ({
                productId: undefined,
                description: it.description,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unit_price),
                taxRate: Number(it.tax_rate ?? 20),
              }))
            : [{ productId: undefined, description: '', quantity: 1, unitPrice: 0, taxRate: 20 }],
      }
    }

    if (!isEditing && prefill) {
      const prefillItems = (prefill.items ?? []).length
        ? (prefill.items ?? []).map((it) => ({
            productId: undefined,
            description: it.description,
            quantity: Number(it.quantity ?? 1),
            unitPrice: Number(it.unitPrice ?? 0),
            taxRate: Number(it.taxRate ?? 20),
          }))
        : [{ productId: undefined, description: '', quantity: 1, unitPrice: 0, taxRate: 20 }]

      return {
        customerId: prefill.customerId ?? '',
        invoiceDate: new Date(),
        dueDate: new Date(),
        invoiceNumber: createDefaultInvoiceNumber(),
        taxInclusive: false,
        notes: prefill.notes ?? '',
        items: prefillItems,
      }
    }

    return {
      customerId: '',
      invoiceDate: new Date(),
      dueDate: new Date(),
      invoiceNumber: createDefaultInvoiceNumber(),
      taxInclusive: false,
      notes: '',
      items: [{ productId: undefined, description: '', quantity: 1, unitPrice: 0, taxRate: 20 }],
    }
  }, [initialInvoice, initialItems, isEditing, prefill])

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateInvoiceValues>({
    resolver: zodResolver(invoiceSchema),
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
  const taxInclusive = watch('taxInclusive')

  const calculateLineTotals = (item: typeof items[0]) => {
    const qty = Number(item?.quantity || 0)
    const price = Number(item?.unitPrice || 0)
    const rate = Number(item?.taxRate || 0)
    const lineTotal = qty * price

    if (taxInclusive) {
      const taxAmount = lineTotal - lineTotal / (1 + rate / 100)
      const subtotalAmount = lineTotal - taxAmount
      return { lineTotal, taxAmount, subtotalAmount }
    } else {
      const taxAmount = lineTotal * (rate / 100)
      const subtotalAmount = lineTotal
      return { lineTotal: lineTotal + taxAmount, taxAmount, subtotalAmount }
    }
  }

  const totals = (items ?? []).reduce(
    (acc, it) => {
      const { lineTotal, taxAmount, subtotalAmount } = calculateLineTotals(it)
      return {
        subtotal: acc.subtotal + subtotalAmount,
        tax: acc.tax + taxAmount,
        total: acc.total + lineTotal,
      }
    },
    { subtotal: 0, tax: 0, total: 0 }
  )

  const onSubmit = async (values: CreateInvoiceValues) => {
    if (!user) return

    // Kota kontrolü - sadece yeni fatura oluştururken
    if (!isEditing) {
      const quotaCheck = canPerformAction('CREATE_INVOICE')
      if (!quotaCheck.allowed) {
        setUpgradeModal({
          open: true,
          reason: quotaCheck.reason,
          message: quotaCheck.message,
          current: quotaCheck.current,
          limit: quotaCheck.limit,
        })
        return
      }
    }

    const finalTotals = (values.items ?? []).reduce(
      (acc, it) => {
        const { lineTotal, taxAmount, subtotalAmount } = calculateLineTotals(it)
        return {
          subtotal: acc.subtotal + subtotalAmount,
          tax: acc.tax + taxAmount,
          total: acc.total + lineTotal,
        }
      },
      { subtotal: 0, tax: 0, total: 0 }
    )

    const mappedItems = values.items.map((it) => {
      const { subtotalAmount } = calculateLineTotals(it)
      return {
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        tax_rate: Number(it.taxRate || 0),
        amount: subtotalAmount,
      }
    })

    if (isEditing && initialInvoice?.id) {
      await updateInvoice.mutateAsync({
        id: initialInvoice.id,
        patch: {
          customer_id: values.customerId,
          invoice_number: values.invoiceNumber,
          invoice_date: format(values.invoiceDate, 'yyyy-MM-dd'),
          due_date: format(values.dueDate, 'yyyy-MM-dd'),
          status: initialInvoice.status,
          subtotal: finalTotals.subtotal,
          tax_amount: finalTotals.tax,
          total_amount: finalTotals.total,
          notes: values.notes?.trim() || null,
        },
      })

      // Delete existing items and create new ones
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', initialInvoice.id)

      if (mappedItems.length > 0) {
        await supabase
          .from('invoice_items')
          .insert(mappedItems.map(item => ({ ...item, invoice_id: initialInvoice.id })))
      }

      onSuccess?.()
      return
    }

    await createInvoice.mutateAsync({
      invoice: {
        user_id: user.id,
        customer_id: values.customerId,
        invoice_number: values.invoiceNumber,
        invoice_date: format(values.invoiceDate, 'yyyy-MM-dd'),
        due_date: format(values.dueDate, 'yyyy-MM-dd'),
        status: 'draft',
        subtotal: finalTotals.subtotal,
        tax_amount: finalTotals.tax,
        total_amount: finalTotals.total,
        notes: values.notes?.trim() || null,
      },
      items: mappedItems,
    })

    onSuccess?.()
  }

  return (
    <>
      <UpgradeRequiredModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false })}
        reason={upgradeModal.reason}
        message={upgradeModal.message}
        current={upgradeModal.current}
        limit={upgradeModal.limit}
        resourceType="invoices"
      />
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('invoices.form.customer')}</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('invoices.form.selectCustomer')} />
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
            {errors.customerId && (
              <p className="text-sm text-destructive">{errors.customerId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">{t('invoices.form.invoiceNumber')}</Label>
            <Input id="invoiceNumber" {...register('invoiceNumber')} />
            {errors.invoiceNumber && (
              <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="invoiceDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label={t('invoices.form.invoiceDate')}
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label={t('invoices.form.dueDate')}
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('invoices.form.itemsSection')}</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="taxInclusive"
                render={({ field }) => (
                  <Switch
                    id="taxInclusive"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="taxInclusive" className="text-sm font-normal cursor-pointer">
                {t('invoices.form.taxInclusive')}
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: undefined, description: '', quantity: 1, unitPrice: 0, taxRate: 20 })}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('invoices.form.addItem')}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">{t('invoices.form.productService')}</TableHead>
                <TableHead className="w-[12%] text-right">{t('invoices.form.quantity')}</TableHead>
                <TableHead className="w-[18%] text-right">{t('invoices.form.unitPrice')}</TableHead>
                <TableHead className="w-[12%] text-right">{t('invoices.form.taxRate')}</TableHead>
                <TableHead className="w-[18%] text-right">{t('invoices.form.total')}</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const row = items?.[index]
                const { lineTotal } = calculateLineTotals(row)

                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Popover
                        open={openProductPicker === index}
                        onOpenChange={(open) => setOpenProductPicker(open ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Input
                              placeholder={t('invoices.form.selectOrType')}
                              {...register(`items.${index}.description` as const)}
                              onClick={() => setOpenProductPicker(index)}
                              className="pr-8"
                            />
                            <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-2 z-[9999]" align="start">
                          <Command>
                            <CommandInput placeholder={t('invoices.form.searchProduct')} />
                            <CommandList className="max-h-[250px]">
                              {products.length === 0 ? (
                                <CommandEmpty>{t('invoices.form.noProductFound')}</CommandEmpty>
                              ) : null}
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    selected={row?.productId === product.id}
                                    onClick={() => {
                                      const currentItems = control._formValues.items
                                      currentItems[index] = {
                                        ...currentItems[index],
                                        productId: product.id,
                                        description: product.name,
                                        unitPrice: Number(product.unit_price),
                                      }
                                      reset({ ...control._formValues, items: currentItems })
                                      setOpenProductPicker(null)
                                    }}
                                    className="flex justify-between items-center"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Check
                                        className={cn(
                                          'h-4 w-4 shrink-0',
                                          row?.productId === product.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{product.name}</div>
                                        {product.description && (
                                          <div className="text-xs text-muted-foreground truncate">{product.description}</div>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm font-mono text-muted-foreground ml-3 shrink-0">
                                      ₺{Number(product.unit_price).toFixed(2)}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {errors.items?.[index]?.description && (
                        <p className="text-xs text-destructive mt-1">
                          {errors.items[index]?.description?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="text-right font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="text-right font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Controller
                        control={control}
                        name={`items.${index}.taxRate` as const}
                        render={({ field }) => (
                          <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                            <SelectTrigger className="text-right font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="1">1%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                              <SelectItem value="20">20%</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ₺{lineTotal.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        title={t('invoices.form.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {typeof errors.items?.message === 'string' ? (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        ) : null}
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">{t('invoices.form.notes')}</Label>
          <Textarea id="notes" placeholder={t('invoices.form.optional')} rows={2} {...register('notes')} />
        </div>

        <div className="border-t pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.form.subtotal')}</span>
              <span className="font-mono font-medium">₺{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.form.totalTax')}</span>
              <span className="font-mono font-medium">₺{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-semibold">{t('invoices.form.grandTotal')}</span>
              <span className="text-lg font-bold font-mono">₺{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {(createInvoice.error || updateInvoice.error) && (
        <p className="text-sm text-destructive">
          {((createInvoice.error || updateInvoice.error) as any)?.message ||
            (isEditing ? t('invoices.form.updateFailed') : t('invoices.form.createFailed'))}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createInvoice.isPending || updateInvoice.isPending || !user}
        >
          {isEditing ? t('invoices.form.updateInvoice') : t('invoices.form.createInvoice')}
        </Button>
      </div>
    </form>
    </>
  )
}
