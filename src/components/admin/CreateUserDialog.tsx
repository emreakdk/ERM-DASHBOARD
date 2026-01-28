import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
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
import { useToast } from '../ui/use-toast'
import { createUser } from '../../pages/admin/userManagement'
import { fetchAdminCompanies } from '../../pages/admin/adminQueries'
import { useQuotaGuard } from '../../hooks/useQuotaGuard'

export function CreateUserDialog() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_id: '__none__',
    role: 'user' as 'admin' | 'user',
  })

  const companiesQuery = useQuery({
    queryKey: ['admin_companies_for_create_user'],
    queryFn: fetchAdminCompanies,
    enabled: open,
  })

  const { canPerformAction } = useQuotaGuard()
  const userQuota = canPerformAction('ADD_USER')
  const isQuotaBlocked = userQuota.allowed === false

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast({
        title: 'Kullanıcı oluşturuldu',
        description: 'Yeni kullanıcı başarıyla sisteme eklendi.',
      })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['company_usage'] })
      setOpen(false)
      setFormData({
        email: '',
        password: '',
        full_name: '',
        company_id: '__none__',
        role: 'user',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error.message || 'Kullanıcı oluşturulamadı',
        variant: 'destructive',
      })
    },
  })

  const showQuotaToast = () => {
    toast({
      title: 'Paket limitine ulaşıldı. Lütfen paketinizi yükseltin.',
      description: userQuota.message,
      variant: 'destructive',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const latestQuota = canPerformAction('ADD_USER')
    if (!latestQuota.allowed) {
      showQuotaToast()
      return
    }
    createMutation.mutate({
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name,
      company_id: formData.company_id === '__none__' ? null : formData.company_id,
      role: formData.role,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && isQuotaBlocked) {
          showQuotaToast()
          return
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={isQuotaBlocked}>
          <UserPlus className="h-4 w-4" />
          Yeni Kullanıcı
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
            <DialogDescription>
              Sisteme yeni bir kullanıcı ekleyin. Kullanıcı bilgileri otomatik olarak e-posta ile
              gönderilecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Ad Soyad</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ahmet Yılmaz"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ahmet@sirket.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 karakter"
                required
                minLength={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'user') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Kullanıcı</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company_id">Şirket</Label>
              <Select
                value={formData.company_id}
                onValueChange={(value) => setFormData({ ...formData, company_id: value })}
              >
                <SelectTrigger id="company_id">
                  <SelectValue placeholder="Şirket seçin (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Şirket Yok —</SelectItem>
                  {companiesQuery.data?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              İptal
            </Button>
            <Button type="submit" disabled={createMutation.isPending || isQuotaBlocked}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
