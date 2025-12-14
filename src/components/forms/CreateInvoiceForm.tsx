import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Trash2, Plus } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateInvoice, useCustomers, useUpdateInvoice } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
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
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Ürün/Hizmet zorunludur'),
  quantity: z.number().positive('Adet 0’dan büyük olmalı'),
  unitPrice: z.number().nonnegative('Fiyat 0 veya büyük olmalı'),
})

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Müşteri zorunludur'),
  invoiceDate: z.date(),
  dueDate: z.date(),
  invoiceNumber: z.string().min(1, 'Fatura no zorunludur'),
  taxRate: z.number().nonnegative(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'En az 1 kalem ekleyin'),
})

type CreateInvoiceValues = z.infer<typeof invoiceSchema>

type CreateInvoiceFormProps = {
  initialInvoice?: Database['public']['Tables']['invoices']['Row']
  initialItems?: Database['public']['Tables']['invoice_items']['Row'][]
  onSuccess?: () => void
}

function createDefaultInvoiceNumber() {
  const now = new Date()
  return `INV-${format(now, 'yyyyMMdd')}-${Math.floor(Math.random() * 9000 + 1000)}`
}

export function CreateInvoiceForm({ initialInvoice, initialItems, onSuccess }: CreateInvoiceFormProps) {
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()

  const isEditing = Boolean(initialInvoice?.id)

  const defaultValues = useMemo<CreateInvoiceValues>(() => {
    if (isEditing && initialInvoice) {
      const inferredTaxRate =
        initialItems && initialItems.length > 0
          ? Number(initialItems[0]?.tax_rate ?? 0)
          : 0

      return {
        customerId: initialInvoice.customer_id,
        invoiceDate: new Date(initialInvoice.invoice_date),
        dueDate: new Date(initialInvoice.due_date),
        invoiceNumber: initialInvoice.invoice_number,
        taxRate: Number.isFinite(inferredTaxRate) ? inferredTaxRate : 0,
        notes: initialInvoice.notes ?? '',
        items:
          (initialItems ?? []).length > 0
            ? (initialItems ?? []).map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unit_price),
              }))
            : [{ description: '', quantity: 1, unitPrice: 0 }],
      }
    }

    return {
      customerId: '',
      invoiceDate: new Date(),
      dueDate: new Date(),
      invoiceNumber: createDefaultInvoiceNumber(),
      taxRate: 20,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    }
  }, [initialInvoice, initialItems, isEditing])

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
  const taxRate = watch('taxRate')

  const subtotal = (items ?? []).reduce(
    (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  )
  const taxAmount = subtotal * (Number(taxRate || 0) / 100)
  const totalAmount = subtotal + taxAmount

  const onSubmit = async (values: CreateInvoiceValues) => {
    if (!user) return

    const nextSubtotal = (values.items ?? []).reduce(
      (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
      0
    )
    const nextTaxAmount = nextSubtotal * (Number(values.taxRate || 0) / 100)
    const nextTotalAmount = nextSubtotal + nextTaxAmount

    const mappedItems = values.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      tax_rate: Number(values.taxRate || 0),
      amount: Number(it.quantity) * Number(it.unitPrice),
    }))

    if (isEditing && initialInvoice?.id) {
      await updateInvoice.mutateAsync({
        id: initialInvoice.id,
        invoice: {
          customer_id: values.customerId,
          invoice_number: values.invoiceNumber,
          invoice_date: format(values.invoiceDate, 'yyyy-MM-dd'),
          due_date: format(values.dueDate, 'yyyy-MM-dd'),
          status: initialInvoice.status,
          subtotal: nextSubtotal,
          tax_amount: nextTaxAmount,
          total_amount: nextTotalAmount,
          notes: values.notes?.trim() || null,
        },
        items: mappedItems,
      })

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
        subtotal: nextSubtotal,
        tax_amount: nextTaxAmount,
        total_amount: nextTotalAmount,
        notes: values.notes?.trim() || null,
      },
      items: mappedItems,
    })

    onSuccess?.()
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Müşteri</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Müşteri seç" />
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
            <Label htmlFor="invoiceNumber">Fatura No</Label>
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
                label="Fatura Tarihi"
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
                label="Vade Tarihi"
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Kalemler</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Kalem Ekle
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const row = items?.[index]
            const rowTotal = Number(row?.quantity || 0) * Number(row?.unitPrice || 0)

            return (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-5 space-y-2">
                    <Label>Ürün/Hizmet</Label>
                    <Input
                      placeholder="Açıklama"
                      {...register(`items.${index}.description` as const)}
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-sm text-destructive">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Adet</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <Label>Birim Fiyat</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                    />
                  </div>

                  <div className="md:col-span-2 flex items-end justify-between gap-2">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Toplam</div>
                      <div className="font-semibold">₺{rowTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      title="Kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
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
            <Label htmlFor="taxRate">KDV (%)</Label>
            <Input
              id="taxRate"
              type="number"
              step="0.01"
              {...register('taxRate', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea id="notes" placeholder="Opsiyonel" {...register('notes')} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span className="font-medium">₺{subtotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">KDV</span>
            <span className="font-medium">₺{taxAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Genel Toplam</span>
            <span className="text-lg font-bold">₺{totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {(createInvoice.error || updateInvoice.error) && (
        <p className="text-sm text-destructive">
          {((createInvoice.error || updateInvoice.error) as any)?.message ||
            (isEditing ? 'Fatura güncellenemedi' : 'Fatura oluşturulamadı')}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createInvoice.isPending || updateInvoice.isPending || !user}
        >
          {isEditing ? 'Faturayı Güncelle' : 'Fatura Oluştur'}
        </Button>
      </div>
    </form>
  )
}
