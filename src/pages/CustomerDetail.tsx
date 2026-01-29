import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { Skeleton } from '../components/ui/skeleton'
import { cn } from '../lib/utils'
import { formatCurrency, formatShortDate } from '../lib/format'
import { INVOICE_STATUS_LABELS } from '../lib/constants'
import {
  useCustomer,
  useCustomerActivities,
  useCustomerDeals,
  useCustomerInvoices,
  useCustomerQuotes,
  useCustomerNotes,
  useCustomerTransactions,
  useCreateCustomerTransaction,
  useUpdateCustomerTransaction,
  useDeleteCustomerTransaction,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useCustomerFiles,
  useUploadCustomerFile,
  useDeleteCustomerFile,
  useDeleteActivity,
  useToggleActivityCompleted,
} from '../hooks/useSupabaseQuery'
import { UnifiedDatePicker } from '../components/shared/UnifiedDatePicker'
import { AddActivityDialog } from '../components/activities/AddActivityDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'
import { toast } from '../components/ui/use-toast'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Building2, Mail, Phone, User, ArrowLeft, FileText, Receipt, Kanban, Calendar, Plus, Pencil, Trash2, File, FileImage, Download } from 'lucide-react'
import { usePermissions } from '../contexts/PermissionsContext'

type CustomerTransactionType = 'debt' | 'credit'

const invoiceStatusVariants: Record<string, 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  cancelled: 'destructive',
}

const invoiceStatusBadgeClasses: Record<string, string> = {
  draft: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  sent: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  paid: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  cancelled: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

const paymentStatusVariants: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  partial: 'default',
  paid: 'default',
}

const paymentStatusBadgeClasses: Record<string, string> = {
  pending: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/20',
  partial: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  paid: invoiceStatusBadgeClasses.paid,
}

function getInvoicePaymentStatus(inv: any) {
  const baseStatus = String(inv?.status ?? '')
  if (baseStatus === 'cancelled') return { key: 'cancelled', label: INVOICE_STATUS_LABELS.cancelled }
  if (baseStatus === 'draft') return { key: 'draft', label: INVOICE_STATUS_LABELS.draft }
  if (baseStatus === 'paid') return { key: 'paid', label: 'Ödendi' }

  const total = Number(inv?.total_amount ?? 0)
  const paidAmount = Array.isArray(inv?.payments)
    ? (inv.payments as any[]).reduce((acc, p) => acc + Number(p?.amount ?? 0), 0)
    : 0

  if (paidAmount <= 0) return { key: 'pending', label: 'Bekliyor' }
  if (paidAmount < total) return { key: 'partial', label: 'Kısmi Ödeme' }
  return { key: 'paid', label: 'Ödendi' }
}

const dealStageLabels: Record<string, string> = {
  new: 'Yeni',
  meeting: 'Toplantı',
  proposal: 'Teklif',
  negotiation: 'Pazarlık',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
}

const dealStageBadge: Record<string, { variant: 'secondary' | 'default' | 'destructive' | 'outline'; className?: string }> = {
  new: {
    variant: 'secondary',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  },
  meeting: {
    variant: 'outline',
    className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  },
  proposal: {
    variant: 'outline',
    className: 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
  },
  negotiation: {
    variant: 'outline',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  },
  won: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
  lost: {
    variant: 'destructive',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  },
}

const quoteStatusLabels: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  accepted: 'Onaylandı',
  rejected: 'Reddedildi',
  converted: 'Faturaya Dönüştü',
}

const quoteBadgeVariants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: {
    variant: 'secondary',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  },
  sent: {
    variant: 'outline',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  },
  accepted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
  rejected: {
    variant: 'destructive',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  },
  converted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
}

function StatCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card className={cn('shadow-sm border-border/50', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

export function CustomerDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const customerId = id ?? null
  const { canEditModule } = usePermissions()
  const canEditCustomers = canEditModule('customers')

  const customerQuery = useCustomer(customerId)
  const invoicesQuery = useCustomerInvoices(customerId)
  const dealsQuery = useCustomerDeals(customerId)
  const quotesQuery = useCustomerQuotes(customerId)
  const customerTransactionsQuery = useCustomerTransactions(customerId)
  const createCustomerTransaction = useCreateCustomerTransaction()
  const updateCustomerTransaction = useUpdateCustomerTransaction()
  const deleteCustomerTransaction = useDeleteCustomerTransaction()
  const activitiesQuery = useCustomerActivities(customerId ?? undefined)
  const notesQuery = useCustomerNotes(customerId)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const filesQuery = useCustomerFiles(customerId)
  const uploadFile = useUploadCustomerFile()
  const deleteFile = useDeleteCustomerFile()
  const toggleActivityCompleted = useToggleActivityCompleted()
  const deleteActivity = useDeleteActivity()

  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [editActivityOpen, setEditActivityOpen] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)

  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [uploadingFilesCount, setUploadingFilesCount] = useState(0)

  const [addTransactionOpen, setAddTransactionOpen] = useState(false)
  const [txType, setTxType] = useState<CustomerTransactionType>('debt')
  const [txDate, setTxDate] = useState<Date>(() => new Date())
  const [txAmount, setTxAmount] = useState<number>(0)
  const [txDescription, setTxDescription] = useState<string>('')

  const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
  const [editTransactionOpen, setEditTransactionOpen] = useState(false)
  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false)
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null)

  const [editTxType, setEditTxType] = useState<CustomerTransactionType>('debt')
  const [editTxDate, setEditTxDate] = useState<Date>(() => new Date())
  const [editTxAmount, setEditTxAmount] = useState<number>(0)
  const [editTxDescription, setEditTxDescription] = useState<string>('')

  const activities = activitiesQuery.data ?? []
  const editingActivity = useMemo(() => {
    if (!editingActivityId) return undefined
    return activities.find((a) => a.id === editingActivityId)
  }, [activities, editingActivityId])

  const formatDateTime = (due?: string | null) => {
    if (!due) return '-'
    const d = new Date(due)
    if (Number.isNaN(d.getTime())) return '-'
    return `${format(d, 'd MMM yyyy', { locale: tr })} - ${format(d, 'HH:mm', { locale: tr })}`
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteActivity.mutateAsync({ id })
      toast({ title: 'Aktivite silindi' })
    } catch (e: any) {
      toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
    }
  }

  const handleAddNote = async () => {
    const content = newNote.trim()
    if (!customerId || !content) return

    try {
      await createNote.mutateAsync({ customer_id: customerId, content, user_id: '' })
      setNewNote('')
      toast({ title: 'Not eklendi' })
    } catch (e) {
      toast({ title: 'Not eklenemedi', description: e instanceof Error ? e.message : 'Hata', variant: 'destructive' })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!customerId) return
    try {
      await deleteNote.mutateAsync({ id: noteId, customer_id: customerId })
      toast({ title: 'Not silindi' })
    } catch (e) {
      toast({ title: 'Silinemedi', description: e instanceof Error ? e.message : 'Hata', variant: 'destructive' })
    }
  }

  const handleStartEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId)
    setEditingNoteContent(content)
  }

  const handleCancelEditNote = () => {
    setEditingNoteId(null)
    setEditingNoteContent('')
  }

  const handleSaveEditNote = async () => {
    const id = editingNoteId
    const content = editingNoteContent.trim()
    if (!id || !content) return

    try {
      await updateNote.mutateAsync({ id, patch: { content } })
      toast({ title: 'Not güncellendi' })
      handleCancelEditNote()
    } catch (e) {
      toast({ title: 'Güncellenemedi', description: e instanceof Error ? e.message : 'Hata', variant: 'destructive' })
    }
  }

  const handleUploadFiles = async (files: File[] | FileList) => {
    if (!customerId) return

    const list = Array.from(files)
    if (list.length === 0) return

    try {
      setUploadingFilesCount(list.length)
      for (const file of list) {
        await uploadFile.mutateAsync({ customer_id: customerId, file })
      }
      toast({ title: list.length > 1 ? 'Dosyalar yüklendi' : 'Dosya yüklendi' })
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
        const match = msg.match(/bucket\s+not\s+found:\s*(.+)$/i)
        const bucketName = match?.[1]?.trim() || 'customer-files'
        toast({
          title: 'Dosya yüklenemedi',
          description:
            `Storage bucket bulunamadı: "${bucketName}". Supabase > Storage bölümünde bu bucket'ı oluşturun veya .env içine VITE_CUSTOMER_FILES_BUCKET=${bucketName} (ya da doğru bucket adı) yazarak uygulamayı yeniden başlatın.`,
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Dosya yüklenemedi', description: e?.message, variant: 'destructive' })
      }
    } finally {
      setUploadingFilesCount(0)
    }
  }

  const handleDeleteFile = async (payload: { path: string }) => {
    if (!customerId) return
    try {
      await deleteFile.mutateAsync({ customer_id: customerId, path: payload.path })
      toast({ title: 'Dosya silindi' })
    } catch (e: any) {
      toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
    }
  }

  const customer = customerQuery.data
  const invoices = invoicesQuery.data ?? []
  const deals = dealsQuery.data ?? []
  const quotes = quotesQuery.data ?? []
  const customerTransactions = customerTransactionsQuery.data ?? []

  const handleStartEditTransaction = (t: any) => {
    setEditingTransaction(t)
    setEditTxType(String(t?.transaction_type) === 'credit' ? 'credit' : 'debt')
    setEditTxDate(t?.transaction_date ? new Date(t.transaction_date) : new Date())
    setEditTxAmount(Number(t?.amount ?? 0))
    setEditTxDescription(String(t?.description ?? ''))
    setEditTransactionOpen(true)
  }

  const stats = useMemo(() => {
    const totalRevenue = invoices
      .filter((inv: any) => inv.status !== 'cancelled')
      .reduce((acc, inv: any) => acc + Number(inv.total_amount ?? 0), 0)
    const openInvoiceTotal = invoices
      .filter((inv: any) => {
        if (inv.status === 'cancelled') return false
        const computed = getInvoicePaymentStatus(inv)
        return computed.key !== 'paid'
      })
      .reduce((acc, inv: any) => acc + Number(inv.total_amount ?? 0), 0)
    const activeDeals = deals.filter((d: any) => d.stage !== 'won' && d.stage !== 'lost').length

    const totalDebt = customerTransactions
      .filter((t: any) => String(t?.transaction_type) === 'debt')
      .reduce((acc: number, t: any) => acc + Number(t?.amount ?? 0), 0)
    const totalCredit = customerTransactions
      .filter((t: any) => String(t?.transaction_type) === 'credit')
      .reduce((acc: number, t: any) => acc + Number(t?.amount ?? 0), 0)
    const balance = totalDebt - totalCredit

    return {
      totalRevenue,
      openInvoiceTotal,
      activeDeals,
      balance,
    }
  }, [customerTransactions, deals, invoices])

  const isLoading =
    customerQuery.isLoading ||
    invoicesQuery.isLoading ||
    dealsQuery.isLoading ||
    quotesQuery.isLoading ||
    customerTransactionsQuery.isLoading ||
    activitiesQuery.isLoading ||
    notesQuery.isLoading ||
    filesQuery.isLoading

  return (
    <AppLayout title={customer?.name ? customer.name : 'Müşteri'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Button>

          {customerId ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                navigate(`/customers/${customerId}/statement`)
              }}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Ekstre Görüntüle</span>
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border bg-white dark:bg-background p-6 shadow-sm">
          {customerQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
          ) : customerQuery.isError || !customer ? (
            <div className="text-sm text-destructive">Müşteri bulunamadı.</div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-10 w-10 shrink-0 rounded-full flex items-center justify-center',
                      customer.type === 'corporate'
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    )}
                  >
                    {customer.type === 'corporate' ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold truncate">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {customer.type === 'corporate' ? 'Kurumsal' : 'Bireysel'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{customer.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{customer.phone || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
                <StatCard title="Toplam Ciro" value={formatCurrency(stats.totalRevenue)} />
                <StatCard title="Açık Fatura" value={formatCurrency(stats.openInvoiceTotal)} />
                <StatCard title="Toplam Bakiye" value={formatCurrency(stats.balance)} />
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          {/* Mobile Scrollable Tabs */}
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1">
            <TabsTrigger value="overview" className="gap-2 shrink-0">
              <User className="h-4 w-4" />
              Genel Bakış
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Hesap Hareketleri
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 shrink-0">
              <Receipt className="h-4 w-4" />
              Faturalar
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-2 shrink-0">
              <Kanban className="h-4 w-4" />
              Fırsatlar
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Teklifler
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-2 shrink-0">
              <Calendar className="h-4 w-4" />
              Aktiviteler
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 shrink-0">
              <Pencil className="h-4 w-4" />
              Notlar
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Dosyalar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Genel Bilgiler</CardTitle>
              </CardHeader>
              <CardContent>
                {customer ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Adres</div>
                      <div className="text-sm">{customer.address || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Notlar</div>
                      <div className="text-sm whitespace-pre-wrap">{(customer as any)?.notes || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Vergi No</div>
                      <div className="text-sm">{customer.tax_number || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Vergi Dairesi</div>
                      <div className="text-sm">{customer.tax_office || '-'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Veri yok</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Hesap Hareketleri</CardTitle>

                <Dialog
                  open={addTransactionOpen}
                  onOpenChange={(v) => {
                    setAddTransactionOpen(v)
                    if (!v) {
                      setTxType('debt')
                      setTxDate(new Date())
                      setTxAmount(0)
                      setTxDescription('')
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button type="button" className="gap-2" disabled={!customerId || !canEditCustomers}>
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">İşlem Ekle</span>
                      <span className="sm:hidden">Ekle</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>İşlem Ekle</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">İşlem Tipi</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant={txType === 'debt' ? 'default' : 'outline'}
                            onClick={() => setTxType('debt')}
                          >
                            Borç Ekle
                          </Button>
                          <Button
                            type="button"
                            variant={txType === 'credit' ? 'default' : 'outline'}
                            onClick={() => setTxType('credit')}
                          >
                            Tahsilat/Alacak Ekle
                          </Button>
                        </div>
                      </div>

                      <UnifiedDatePicker value={txDate} onChange={(d) => d && setTxDate(d)} label="Tarih" />

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Tutar</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={String(txAmount)}
                          onChange={(e) => {
                            const v = e.target.value
                            setTxAmount(v === '' ? 0 : Number(v))
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Açıklama</div>
                        <Input value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder='Örn: Devir Bakiyesi' />
                      </div>

                      {(createCustomerTransaction.error as any)?.message ? (
                        <p className="text-sm text-destructive">{(createCustomerTransaction.error as any)?.message}</p>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={
                            createCustomerTransaction.isPending ||
                            !customerId ||
                            !txDescription.trim() ||
                            !(Number(txAmount) > 0)
                          }
                          onClick={async () => {
                            if (!customerId) return

                            try {
                              await createCustomerTransaction.mutateAsync({
                                customer_id: customerId,
                                transaction_type: txType,
                                amount: Number(txAmount),
                                transaction_date: format(txDate, 'yyyy-MM-dd'),
                                description: txDescription.trim(),
                                currency: 'TRY',
                              })
                              toast({ title: 'İşlem eklendi' })
                              setAddTransactionOpen(false)
                            } catch (e: any) {
                              toast({ title: 'İşlem eklenemedi', description: e?.message, variant: 'destructive' })
                            }
                          }}
                        >
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : customerTransactionsQuery.isError ? (
                  <div className="text-sm text-destructive">
                    {(customerTransactionsQuery.error as any)?.message || 'Hareketler yüklenemedi'}
                  </div>
                ) : customerTransactions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu müşteriye ait işlem yok.</div>
                ) : (
                  // Mobile Table Fix
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Açıklama</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">İşlem Tipi</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Tutar</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerTransactions.map((t: any, idx: number) => {
                          const type = String(t.transaction_type)
                          const isDebt = type === 'debt'
                          const badgeClass = isDebt
                            ? 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20'
                            : 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20'

                          return (
                            <tr key={t.id ?? `${t.transaction_date}-${t.amount}-${t.description}-${idx}`} className="border-b">
                              <td className="p-4">{formatShortDate(t.transaction_date)}</td>
                              <td className="p-4">{t.description}</td>
                              <td className="p-4">
                                <Badge variant="outline" className={badgeClass}>
                                  {isDebt ? 'Borç' : 'Alacak'}
                                </Badge>
                              </td>
                              <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(Number(t.amount ?? 0))}</td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartEditTransaction(t)}
                                    disabled={!canEditCustomers}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Düzenle
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setDeletingTransaction(t)
                                      setDeleteTransactionOpen(true)
                                    }}
                                    disabled={!canEditCustomers}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Sil
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <Dialog
                  open={editTransactionOpen}
                  onOpenChange={(v) => {
                    setEditTransactionOpen(v)
                    if (!v) {
                      setEditingTransaction(null)
                      setEditTxType('debt')
                      setEditTxDate(new Date())
                      setEditTxAmount(0)
                      setEditTxDescription('')
                    }
                  }}
                >
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>İşlem Düzenle</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">İşlem Tipi</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant={editTxType === 'debt' ? 'default' : 'outline'}
                            onClick={() => setEditTxType('debt')}
                          >
                            Borç
                          </Button>
                          <Button
                            type="button"
                            variant={editTxType === 'credit' ? 'default' : 'outline'}
                            onClick={() => setEditTxType('credit')}
                          >
                            Alacak
                          </Button>
                        </div>
                      </div>

                      <UnifiedDatePicker value={editTxDate} onChange={(d) => d && setEditTxDate(d)} label="Tarih" />

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Tutar</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={String(editTxAmount)}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditTxAmount(v === '' ? 0 : Number(v))
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Açıklama</div>
                        <Input
                          value={editTxDescription}
                          onChange={(e) => setEditTxDescription(e.target.value)}
                          placeholder="Örn: Elden Tahsilat"
                        />
                      </div>

                      {(updateCustomerTransaction.error as any)?.message ? (
                        <p className="text-sm text-destructive">{(updateCustomerTransaction.error as any)?.message}</p>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={
                            updateCustomerTransaction.isPending ||
                            !editingTransaction ||
                            !editTxDescription.trim() ||
                            !(Number(editTxAmount) > 0)
                          }
                          onClick={async () => {
                            if (!editingTransaction) return
                            if (!customerId) return

                            try {
                              await updateCustomerTransaction.mutateAsync({
                                id: String(editingTransaction.id),
                                patch: {
                                  customer_id: customerId,
                                  transaction_type: editTxType,
                                  amount: Number(editTxAmount),
                                  transaction_date: format(editTxDate, 'yyyy-MM-dd'),
                                  description: editTxDescription.trim(),
                                  currency: String(editingTransaction.currency ?? 'TRY'),
                                },
                              })
                              toast({ title: 'İşlem güncellendi' })
                              setEditTransactionOpen(false)
                            } catch (e: any) {
                              toast({ title: 'Güncellenemedi', description: e?.message, variant: 'destructive' })
                            }
                          }}
                        >
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={deleteTransactionOpen} onOpenChange={(v) => setDeleteTransactionOpen(v)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setDeleteTransactionOpen(false)
                          setDeletingTransaction(null)
                        }}
                      >
                        Vazgeç
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteCustomerTransaction.isPending || !deletingTransaction}
                        onClick={async () => {
                          if (!deletingTransaction) return
                          if (!customerId) return

                          try {
                            await deleteCustomerTransaction.mutateAsync({
                              id: String(deletingTransaction.id),
                              customer_id: customerId,
                            })
                            toast({ title: 'Kayıt silindi' })
                          } catch (e: any) {
                            toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
                          } finally {
                            setDeleteTransactionOpen(false)
                            setDeletingTransaction(null)
                          }
                        }}
                      >
                        Sil
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Faturalar</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu müşteriye ait fatura yok.</div>
                ) : (
                  // Mobile Table Fix
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Fatura No</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Hizmet/Ürün</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv: any) => {
                          const items = (inv.invoice_items ?? []) as Array<{ description?: string | null }>
                          const first = items[0]?.description ?? ''
                          const itemsLabel =
                            items.length === 0
                              ? '-'
                              : items.length === 1
                                ? String(first)
                                : `${String(first)} (+${items.length - 1} kalem)`

                          const displayStatus = getInvoicePaymentStatus(inv)
                          const variant =
                            displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                              ? invoiceStatusVariants[String(inv.status)] ?? 'secondary'
                              : paymentStatusVariants[displayStatus.key] ?? 'secondary'
                          const badgeClassName =
                            displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                              ? invoiceStatusBadgeClasses[String(inv.status)]
                              : paymentStatusBadgeClasses[displayStatus.key] ?? ''
                          const statusLabel =
                            displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                              ? (INVOICE_STATUS_LABELS as any)?.[String(inv.status)] ?? String(inv.status)
                              : displayStatus.label

                          return (
                            <tr key={inv.id} className="border-b">
                              <td className="p-4 font-medium">{inv.invoice_number}</td>
                              <td className="p-4">{formatShortDate(inv.invoice_date)}</td>
                              <td className="p-4 max-w-[420px]">
                                <div className="truncate" title={itemsLabel}>
                                  {itemsLabel}
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant={variant} className={badgeClassName}>
                                  {statusLabel}
                                </Badge>
                              </td>
                              <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(Number(inv.total_amount ?? 0))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <CardTitle>Fırsatlar</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : deals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu müşteriye ait fırsat yok.</div>
                ) : (
                  // Mobile Table Fix
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Başlık</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Aşama</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Beklenen Kapanış</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map((d: any) => {
                          const badge = dealStageBadge[String(d.stage)] ?? { variant: 'secondary' as const }
                          return (
                            <tr key={d.id} className="border-b">
                              <td className="p-4 font-medium">{d.title}</td>
                              <td className="p-4">
                                <Badge variant={badge.variant} className={badge.className}>
                                  {dealStageLabels[String(d.stage)] ?? String(d.stage)}
                                </Badge>
                              </td>
                              <td className="p-4">{d.expected_close_date ? formatShortDate(d.expected_close_date) : '-'}</td>
                              <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(Number(d.value ?? 0))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes">
            <Card>
              <CardHeader>
                <CardTitle>Teklifler</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : quotes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu müşteriye ait teklif yok.</div>
                ) : (
                  // Mobile Table Fix
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Teklif No</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Hizmet/Ürün</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotes.map((q: any) => {
                          const items = (q.quote_items ?? []) as Array<{ description?: string | null; product_name?: string | null }>
                          const firstName = items[0]?.product_name ?? items[0]?.description ?? ''
                          const itemsLabel =
                            items.length === 0
                              ? '-'
                              : items.length === 1
                                ? String(firstName)
                                : `${String(firstName)} (+${items.length - 1} kalem)`

                          const badge = quoteBadgeVariants[String(q.status)] ?? { variant: 'secondary' as const }
                          return (
                            <tr key={q.id} className="border-b">
                              <td className="p-4 font-medium">{q.quote_number}</td>
                              <td className="p-4 max-w-[420px]">
                                <div className="truncate" title={itemsLabel}>
                                  {itemsLabel}
                                </div>
                              </td>
                              <td className="p-4">{formatShortDate(q.issue_date)}</td>
                              <td className="p-4">
                                <Badge variant={badge.variant} className={badge.className}>
                                  {quoteStatusLabels[String(q.status)] ?? String(q.status)}
                                </Badge>
                              </td>
                              <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(Number(q.total_amount ?? 0))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Aktiviteler</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={() => setAddActivityOpen(true)}
                  disabled={!canEditCustomers}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Yeni Aktivite Ekle</span>
                  <span className="sm:hidden">Ekle</span>
                </Button>
              </CardHeader>
              <CardContent>
                <AddActivityDialog
                  open={addActivityOpen}
                  onOpenChange={setAddActivityOpen}
                  defaultCustomerId={customerId ?? undefined}
                />

                <AddActivityDialog
                  open={editActivityOpen}
                  onOpenChange={(o) => {
                    setEditActivityOpen(o)
                    if (!o) setEditingActivityId(null)
                  }}
                  defaultCustomerId={customerId ?? undefined}
                  activity={editingActivity}
                />

                {activitiesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : activitiesQuery.isError ? (
                  <div className="text-sm text-destructive">Aktiviteler yüklenemedi.</div>
                ) : (activitiesQuery.data ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu müşteriye ait aktivite yok.</div>
                ) : (
                  // Mobile Table Fix
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tamam</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Konu</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tür</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((a) => {
                          const typeLabel =
                            a.type === 'task'
                              ? 'Görev'
                              : a.type === 'meeting'
                                ? 'Toplantı'
                                : a.type === 'call'
                                  ? 'Arama'
                                  : a.type === 'email'
                                    ? 'E-posta'
                                    : String(a.type)

                          return (
                            <tr key={a.id} className="border-b">
                              <td className="p-4">
                                <Checkbox
                                  checked={Boolean(a.is_completed)}
                                  onCheckedChange={(v: boolean | 'indeterminate') =>
                                    toggleActivityCompleted.mutate({ id: a.id, is_completed: Boolean(v) })
                                  }
                                  disabled={!canEditCustomers}
                                />
                              </td>
                              <td className={cn('p-4 font-medium', a.is_completed && 'line-through text-muted-foreground')}>
                                {a.subject}
                              </td>
                              <td className="p-4">
                                <Badge variant="secondary">{typeLabel}</Badge>
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">{formatDateTime(a.due_date)}</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      setEditingActivityId(a.id)
                                      setEditActivityOpen(true)
                                    }}
                                    disabled={!canEditCustomers}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button type="button" variant="outline" size="icon" disabled={!canEditCustomers}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Aktivite silinsin mi?</AlertDialogTitle>
                                        <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => void handleDeleteActivity(a.id)}>Sil</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle>Notlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Not yaz..."
                    className="bg-background"
                    disabled={!canEditCustomers}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleAddNote()}
                      disabled={!customerId || !canEditCustomers || createNote.isPending || newNote.trim().length === 0}
                    >
                      {createNote.isPending ? 'Ekleniyor...' : 'Not Ekle'}
                    </Button>
                  </div>
                </div>

                {notesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : notesQuery.isError ? (
                  <div className="text-sm text-destructive">Notlar yüklenemedi.</div>
                ) : (notesQuery.data ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Henüz not eklenmedi.</div>
                ) : (
                  <div className="space-y-3">
                    {(notesQuery.data ?? []).map((n) => {
                      const createdAt = n.created_at ? new Date(n.created_at) : null
                      const relative = createdAt
                        ? formatDistanceToNow(createdAt, { addSuffix: true, locale: tr })
                        : '-'

                      const isEditing = editingNoteId === n.id

                      return (
                        <div key={n.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingNoteContent}
                                    onChange={(e) => setEditingNoteContent(e.target.value)}
                                    className="bg-background"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={handleCancelEditNote}>
                                      Vazgeç
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => void handleSaveEditNote()}
                                      disabled={updateNote.isPending || editingNoteContent.trim().length === 0}
                                    >
                                      {updateNote.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap text-sm">{n.content}</div>
                              )}
                              <div className="mt-2 text-xs text-muted-foreground">{relative}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={!canEditCustomers || Boolean(editingNoteId) || deleteNote.isPending}
                                onClick={() => handleStartEditNote(n.id, n.content)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" disabled={!canEditCustomers || deleteNote.isPending}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Not silinsin mi?</AlertDialogTitle>
                                    <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void handleDeleteNote(n.id)}>Sil</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Dosyalar</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files
                      if (!files || files.length === 0) return
                      void handleUploadFiles(files)
                      e.currentTarget.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!customerId || !canEditCustomers || uploadFile.isPending || uploadingFilesCount > 0}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadFile.isPending || uploadingFilesCount > 0 ? 'Yükleniyor...' : 'Dosya Seç'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'mb-4 rounded-lg border border-dashed p-4 transition-colors bg-card',
                    isDraggingFile ? 'border-primary/60 bg-muted/40' : 'border-border',
                    (!customerId || !canEditCustomers || uploadFile.isPending || uploadingFilesCount > 0) && 'opacity-60 pointer-events-none'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingFile(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingFile(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingFile(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingFile(false)
                    const files = e.dataTransfer.files
                    if (!files || files.length === 0) return
                    void handleUploadFiles(files)
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Dosyaları buraya sürükle bırak</div>
                      <div className="text-xs text-muted-foreground">PDF veya görsel • çoklu seçim desteklenir</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Tıkla</div>
                  </div>
                </div>

                {filesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : filesQuery.isError ? (
                  <div className="text-sm text-destructive">Dosyalar yüklenemedi.</div>
                ) : (filesQuery.data ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Henüz dosya yüklenmedi.</div>
                ) : (
                  <div className="space-y-3">
                    {(filesQuery.data ?? []).map((a) => {
                      const fileName = String(a.file_name ?? 'Dosya')
                      const lower = fileName.toLowerCase()
                      const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')
                      const isPdf = lower.endsWith('.pdf')
                      const href = a.file_url ?? undefined
                      const icon = isImage ? (
                        <FileImage className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : isPdf ? (
                        <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )

                      const sizeBytes = Number((a as any)?.metadata?.size ?? 0)
                      const sizeLabel = sizeBytes > 0 ? `${Math.round(sizeBytes / 1024)} KB` : '-'

                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                              {isImage && href ? (
                                <img src={href} alt={fileName} className="h-full w-full object-cover" />
                              ) : (
                                icon
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{fileName}</div>
                              <div className="text-xs text-muted-foreground">{sizeLabel}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                Aç
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}

                            {href ? (
                              <a
                                href={href}
                                download={fileName}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                title="İndir"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            ) : null}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline" size="icon" disabled={!canEditCustomers || deleteFile.isPending}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Dosya silinsin mi?</AlertDialogTitle>
                                  <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>İptal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleDeleteFile({ path: a.file_url })}>
                                    Sil
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}