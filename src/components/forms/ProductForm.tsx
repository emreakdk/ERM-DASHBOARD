import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateProduct, useUpdateProduct } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useTranslation } from 'react-i18next'

const buildProductSchema = (t: (key: string) => string) =>
  z
    .object({
      name: z.string().min(1, t('products.form.errors.nameRequired')),
      type: z.enum(['service', 'product']),
      sku: z.string().optional(),
      unit_price: z
        .number()
        .finite(t('products.form.errors.priceRequired'))
        .min(0, t('products.form.errors.priceRequired')),
      stock_quantity: z
        .number()
        .finite(t('products.form.errors.stockInvalid'))
        .int(t('products.form.errors.stockInteger'))
        .min(0, t('products.form.errors.stockMin'))
        .optional(),
      description: z.string().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.type === 'service') return
      if (val.stock_quantity === undefined) return
      if (!Number.isFinite(val.stock_quantity)) {
        ctx.addIssue({
          code: 'custom',
          message: t('products.form.errors.stockInvalid'),
          path: ['stock_quantity'],
        })
      }
    })

type ProductFormValues = z.infer<ReturnType<typeof buildProductSchema>>

type ProductFormProps = {
  initialProduct?: Database['public']['Tables']['products']['Row']
  onSuccess?: () => void
}

export function ProductForm({ initialProduct, onSuccess }: ProductFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const isEditing = Boolean(initialProduct?.id)

  const [type, setType] = useState<'service' | 'product'>(initialProduct?.type ?? 'service')

  const defaultValues = useMemo<ProductFormValues>(
    () => ({
      name: initialProduct?.name ?? '',
      type: initialProduct?.type ?? 'service',
      sku: initialProduct?.sku ?? '',
      unit_price: Number(initialProduct?.unit_price ?? 0),
      stock_quantity:
        initialProduct?.type === 'product' && initialProduct.stock_quantity !== null
          ? Number(initialProduct.stock_quantity)
          : undefined,
      description: initialProduct?.description ?? '',
    }),
    [initialProduct]
  )

  const productSchema = useMemo(() => buildProductSchema(t), [t])

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    reset(defaultValues)
    setType(defaultValues.type)
  }, [defaultValues, reset])

  const watchedType = watch('type')

  const onSubmit = async (values: ProductFormValues) => {
    if (!user) return

    const patch: Database['public']['Tables']['products']['Insert'] = {
      user_id: user.id,
      name: values.name.trim(),
      type: values.type,
      sku: values.sku?.trim() ? values.sku.trim() : null,
      description: values.description?.trim() ? values.description.trim() : null,
      unit_price: Number(values.unit_price ?? 0),
      stock_quantity:
        values.type === 'product' && values.stock_quantity !== undefined
          ? Number(values.stock_quantity)
          : null,
    }

    if (isEditing && initialProduct?.id) {
      const updatePatch: Database['public']['Tables']['products']['Update'] = {
        name: patch.name,
        type: patch.type,
        sku: patch.sku,
        description: patch.description,
        unit_price: patch.unit_price,
        stock_quantity: patch.stock_quantity,
      }
      await updateProduct.mutateAsync({ id: initialProduct.id, patch: updatePatch })
    } else {
      await createProduct.mutateAsync(patch)
    }

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">{t('products.form.nameLabel')}</Label>
        <Input id="name" placeholder={t('products.form.namePlaceholder')} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">{t('products.form.typeLabel')}</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              const next = v as 'service' | 'product'
              setType(next)
              setValue('type', next)
              if (next === 'service') {
                setValue('stock_quantity', undefined)
              }
            }}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder={t('products.form.typePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="service">{t('common.service')}</SelectItem>
              <SelectItem value="product">{t('common.product')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">{t('products.form.skuLabel')}</Label>
          <Input id="sku" placeholder={t('products.form.skuPlaceholder')} {...register('sku')} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unit_price">{t('products.form.priceLabel')}</Label>
          <Input
            id="unit_price"
            type="number"
            step="0.01"
            placeholder={t('products.form.pricePlaceholder')}
            {...register('unit_price', { valueAsNumber: true })}
          />
          {errors.unit_price && <p className="text-sm text-destructive">{errors.unit_price.message}</p>}
        </div>

        {watchedType === 'product' ? (
          <div className="space-y-2">
            <Label htmlFor="stock_quantity">{t('products.form.stockLabel')}</Label>
            <Input
              id="stock_quantity"
              type="number"
              step="1"
              placeholder={t('products.form.stockPlaceholder')}
              {...register('stock_quantity', {
                setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
              })}
            />
            {errors.stock_quantity && <p className="text-sm text-destructive">{errors.stock_quantity.message}</p>}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('products.form.descriptionLabel')}</Label>
        <Textarea id="description" placeholder={t('products.form.descriptionPlaceholder')} {...register('description')} />
      </div>

      {(createProduct.error || updateProduct.error) && (
        <p className="text-sm text-destructive">
          {((createProduct.error || updateProduct.error) as any)?.message ||
            (isEditing ? t('products.form.updateError') : t('products.form.createError'))}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending || !user}>
          {t('products.form.submitButton')}
        </Button>
      </div>
    </form>
  )
}
