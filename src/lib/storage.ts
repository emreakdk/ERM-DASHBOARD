import { supabase } from './supabase'

export type UploadResult = {
  url: string
  path: string
}

export async function uploadCompanyLogo(file: File, companyId: string): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${companyId}-${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  const { data, error } = await supabase.storage
    .from('company-logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw error
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('company-logos').getPublicUrl(data.path)

  return {
    url: publicUrl,
    path: data.path,
  }
}

export async function deleteCompanyLogo(path: string): Promise<void> {
  const { error } = await supabase.storage.from('company-logos').remove([path])

  if (error) {
    throw error
  }
}
