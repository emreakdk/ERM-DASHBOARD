-- Manuel RLS Policy Ekleme: Kullanıcıların kendi şirket izinlerini görmesini sağla
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın

-- Önce mevcut policy varsa temizle
DROP POLICY IF EXISTS "Users can view their company permissions" ON public.role_permissions;

-- Yeni policy oluştur
CREATE POLICY "Users can view their company permissions"
  ON public.role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'user'
        AND profiles.company_id = role_permissions.company_id
    )
  );

-- Doğrulama: Policy'nin oluşturulduğunu kontrol et
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'role_permissions'
ORDER BY policyname;
