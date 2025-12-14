import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateCustomer, useUpdateCustomer } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'

const customerSchema = z
  .object({
    kind: z.enum(['individual', 'corporate']),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    taxNumber: z.string().optional(),
    taxOffice: z.string().optional(),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Geçerli bir e-posta girin').optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'individual') {
      if (!val.firstName || val.firstName.trim().length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Ad zorunludur', path: ['firstName'] })
      }
      if (!val.lastName || val.lastName.trim().length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Soyad zorunludur', path: ['lastName'] })
      }
    }

    if (val.kind === 'corporate') {
      if (!val.companyName || val.companyName.trim().length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Şirket adı zorunludur', path: ['companyName'] })
      }
    }
  })

type CustomerFormValues = z.infer<typeof customerSchema>

type CustomerFormProps = {
  initialCustomer?: Database['public']['Tables']['customers']['Row']
  onSuccess?: () => void
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: fullName.trim(), lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? '',
  }
}

export function CustomerForm({ initialCustomer, onSuccess }: CustomerFormProps) {
  const { user } = useAuth()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  const isEditing = Boolean(initialCustomer?.id)

  const [kind, setKind] = useState<'individual' | 'corporate'>(
    initialCustomer?.type ?? 'individual'
  )

  const defaultValues = useMemo<CustomerFormValues>(
    () => {
      const initialKind = initialCustomer?.type ?? 'individual'
      const nameParts = initialKind === 'individual' ? splitName(initialCustomer?.name ?? '') : null

      return {
        kind: initialKind,
        firstName: nameParts?.firstName ?? '',
        lastName: nameParts?.lastName ?? '',
        companyName: initialKind === 'corporate' ? (initialCustomer?.name ?? '') : '',
        taxNumber: initialCustomer?.tax_number ?? '',
        taxOffice: initialCustomer?.tax_office ?? '',
        contactPerson: initialCustomer?.contact_person ?? '',
        phone: initialCustomer?.phone ?? '',
        email: initialCustomer?.email ?? '',
      }
    },
    [initialCustomer]
  )

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    reset(defaultValues)
    setKind(defaultValues.kind)
  }, [defaultValues, reset])

  const onSubmit = async (values: CustomerFormValues) => {
    if (!user) return

    const name =
      values.kind === 'individual'
        ? `${values.firstName?.trim() ?? ''} ${values.lastName?.trim() ?? ''}`.trim()
        : (values.companyName?.trim() ?? '').trim()

    if (isEditing && initialCustomer?.id) {
      await updateCustomer.mutateAsync({
        id: initialCustomer.id,
        patch: {
          name,
          type: values.kind,
          phone: values.phone?.trim() || null,
          email: values.email?.trim() || null,
          tax_number: values.kind === 'corporate' ? values.taxNumber?.trim() || null : null,
          tax_office: values.kind === 'corporate' ? values.taxOffice?.trim() || null : null,
          contact_person:
            values.kind === 'corporate' ? values.contactPerson?.trim() || null : null,
        },
      })
    } else {
      await createCustomer.mutateAsync({
        user_id: user.id,
        name,
        type: values.kind,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        tax_number: values.kind === 'corporate' ? values.taxNumber?.trim() || null : null,
        tax_office: values.kind === 'corporate' ? values.taxOffice?.trim() || null : null,
        contact_person:
          values.kind === 'corporate' ? values.contactPerson?.trim() || null : null,
      })
    }

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <Tabs
        value={kind}
        onValueChange={(v) => {
          const next = v as 'individual' | 'corporate'
          setKind(next)
          setValue('kind', next)
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="individual">Bireysel</TabsTrigger>
          <TabsTrigger value="corporate">Kurumsal</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === 'individual' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Ad</Label>
            <Input id="firstName" placeholder="Ad" {...register('firstName')} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Soyad</Label>
            <Input id="lastName" placeholder="Soyad" {...register('lastName')} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Şirket Adı</Label>
            <Input id="companyName" placeholder="Şirket Adı" {...register('companyName')} />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPerson">Yetkili Kişi</Label>
            <Input id="contactPerson" placeholder="Yetkili Kişi" {...register('contactPerson')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxOffice">Vergi Dairesi</Label>
            <Input id="taxOffice" placeholder="Vergi Dairesi" {...register('taxOffice')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxNumber">Vergi No (VKN)</Label>
            <Input id="taxNumber" placeholder="Vergi No" {...register('taxNumber')} />
            {errors.taxNumber && (
              <p className="text-sm text-destructive">{errors.taxNumber.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" placeholder="+90 (5XX) XXX XX XX" {...register('phone')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" placeholder="ornek@firma.com" {...register('email')} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {(createCustomer.error || updateCustomer.error) && (
        <p className="text-sm text-destructive">
          {((createCustomer.error || updateCustomer.error) as any)?.message ||
            (isEditing ? 'Müşteri güncellenemedi' : 'Müşteri oluşturulamadı')}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createCustomer.isPending || updateCustomer.isPending || !user}
        >
          Kaydet
        </Button>
      </div>
    </form>
  )
}
