import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateCustomer, useUpdateCustomer } from '../../hooks/useSupabaseQuery'
import { useQuotaGuard } from '../../hooks/useQuotaGuard'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { useToast } from '../ui/use-toast'
import { useTranslation } from 'react-i18next'

const buildCustomerSchema = (t: (key: string) => string) =>
  z
    .object({
      kind: z.enum(['individual', 'corporate']),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      companyName: z.string().optional(),
      taxNumber: z.string().optional(),
      taxOffice: z.string().optional(),
      contactPerson: z.string().optional(),
      phone: z.string().optional(),
      email: z
        .string()
        .email(t('customers.form.errors.emailInvalid'))
        .optional()
        .or(z.literal('')),
    })
    .superRefine((val, ctx) => {
      if (val.kind === 'individual') {
        if (!val.firstName || val.firstName.trim().length === 0) {
          ctx.addIssue({ code: 'custom', message: t('customers.form.errors.firstNameRequired'), path: ['firstName'] })
        }
        if (!val.lastName || val.lastName.trim().length === 0) {
          ctx.addIssue({ code: 'custom', message: t('customers.form.errors.lastNameRequired'), path: ['lastName'] })
        }
      }

      if (val.kind === 'corporate') {
        if (!val.companyName || val.companyName.trim().length === 0) {
          ctx.addIssue({ code: 'custom', message: t('customers.form.errors.companyNameRequired'), path: ['companyName'] })
        }
      }
    })

type CustomerFormValues = z.infer<ReturnType<typeof buildCustomerSchema>>

type CustomerFormProps = {
  initialCustomer?: Database['public']['Tables']['customers']['Row']
  defaultCustomerStatus?: 'customer' | 'lead'
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

export function CustomerForm({ initialCustomer, defaultCustomerStatus, onSuccess }: CustomerFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const { canPerformAction } = useQuotaGuard()
  const { toast } = useToast()

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

  const customerSchema = useMemo(() => buildCustomerSchema(t), [t])

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
    if (!isEditing) {
      const quotaCheck = canPerformAction('ADD_CUSTOMER')
      if (!quotaCheck.allowed) {
        toast({
          title: t('customers.form.quotaLimitTitle'),
          description: quotaCheck.message || t('customers.form.quotaLimitDescription'),
          variant: 'destructive',
        })
        return
      }
    }
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
        customer_status: defaultCustomerStatus || 'customer',
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
          <TabsTrigger value="individual">{t('customers.form.individualTab')}</TabsTrigger>
          <TabsTrigger value="corporate">{t('customers.form.corporateTab')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === 'individual' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t('customers.form.firstNameLabel')}</Label>
            <Input id="firstName" placeholder={t('customers.form.firstNamePlaceholder')} {...register('firstName')} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t('customers.form.lastNameLabel')}</Label>
            <Input id="lastName" placeholder={t('customers.form.lastNamePlaceholder')} {...register('lastName')} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">{t('customers.form.companyNameLabel')}</Label>
            <Input
              id="companyName"
              placeholder={t('customers.form.companyNamePlaceholder')}
              {...register('companyName')}
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPerson">{t('customers.form.contactPersonLabel')}</Label>
            <Input
              id="contactPerson"
              placeholder={t('customers.form.contactPersonPlaceholder')}
              {...register('contactPerson')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxOffice">{t('customers.form.taxOfficeLabel')}</Label>
            <Input id="taxOffice" placeholder={t('customers.form.taxOfficePlaceholder')} {...register('taxOffice')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxNumber">{t('customers.form.taxNumberLabel')}</Label>
            <Input id="taxNumber" placeholder={t('customers.form.taxNumberPlaceholder')} {...register('taxNumber')} />
            {errors.taxNumber && (
              <p className="text-sm text-destructive">{errors.taxNumber.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">{t('customers.form.phoneLabel')}</Label>
          <Input id="phone" placeholder={t('customers.form.phonePlaceholder')} {...register('phone')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t('customers.form.emailLabel')}</Label>
          <Input id="email" type="email" placeholder={t('customers.form.emailPlaceholder')} {...register('email')} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {(createCustomer.error || updateCustomer.error) && (
        <p className="text-sm text-destructive">
          {((createCustomer.error || updateCustomer.error) as any)?.message ||
            (isEditing ? t('customers.form.updateError') : t('customers.form.createError'))}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createCustomer.isPending || updateCustomer.isPending || !user}
        >
          {t('customers.form.submitButton')}
        </Button>
      </div>
    </form>
  )
}
