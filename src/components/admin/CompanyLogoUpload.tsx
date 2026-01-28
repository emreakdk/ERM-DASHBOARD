import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { useToast } from '../ui/use-toast'
import { uploadCompanyLogo, deleteCompanyLogo } from '../../lib/storage'
import { cn } from '../../lib/utils'
import { useTranslation } from 'react-i18next'

type CompanyLogoUploadProps = {
  companyId: string
  currentLogoUrl?: string | null
  onUploadSuccess: (url: string) => void
}

export function CompanyLogoUpload({
  companyId,
  currentLogoUrl,
  onUploadSuccess,
}: CompanyLogoUploadProps) {
  const { toast } = useToast()
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const result = await uploadCompanyLogo(file, companyId)
      return result
    },
    onSuccess: (data) => {
      setPreview(data.url)
      onUploadSuccess(data.url)
      toast({
        title: t('admin.logoUpload.toastSuccessTitle'),
        description: t('admin.logoUpload.toastSuccessDesc'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('admin.logoUpload.toastErrorTitle'),
        description: error.message || t('admin.logoUpload.toastErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      await deleteCompanyLogo(path)
    },
    onSuccess: () => {
      setPreview(null)
      onUploadSuccess('')
      toast({
        title: t('admin.logoUpload.toastDeleteTitle'),
        description: t('admin.logoUpload.toastDeleteDesc'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('admin.logoUpload.toastDeleteErrorTitle'),
        description: error.message || t('admin.logoUpload.toastDeleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('admin.logoUpload.invalidFileTitle'),
        description: t('admin.logoUpload.invalidFileDesc'),
        variant: 'destructive',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('admin.logoUpload.fileTooLargeTitle'),
        description: t('admin.logoUpload.fileTooLargeDesc'),
        variant: 'destructive',
      })
      return
    }

    uploadMutation.mutate(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleRemove = () => {
    if (currentLogoUrl) {
      const path = currentLogoUrl.split('/').pop()
      if (path) {
        deleteMutation.mutate(path)
      }
    } else {
      setPreview(null)
      onUploadSuccess('')
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative flex h-40 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-accent/50',
          uploadMutation.isPending && 'pointer-events-none opacity-60'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={uploadMutation.isPending}
        />

        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{t('admin.logoUpload.loading')}</p>
          </div>
        ) : preview ? (
          <div className="relative h-full w-full p-4">
            <img
              src={preview}
              alt={t('admin.logoUpload.altText')}
              className="h-full w-full object-contain"
              onError={() => setPreview(null)}
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="rounded-full bg-primary/10 p-3">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{t('admin.logoUpload.click')}</p>
              <p className="text-xs">{t('admin.logoUpload.dragDrop')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('admin.logoUpload.formats')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
