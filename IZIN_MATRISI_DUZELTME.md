# İzin Matrisi Kullanıcı Hesapları Düzeltme Rehberi

## Sorun
İzin matrisinde kullanıcılar için modül görüntüleme izinleri kapatıldığında, admin hesaplarında sidebar doğru filtreleniyor ancak kullanıcı hesaplarında tüm sayfalar görünmeye devam ediyor.

## Çözüm Adımları

### 1. Supabase Dashboard'a Giriş Yapın
1. https://supabase.com adresine gidin
2. Projenize giriş yapın
3. Sol menüden **SQL Editor** seçeneğine tıklayın

### 2. SQL Komutunu Çalıştırın
1. "New query" butonuna tıklayın
2. Aşağıdaki SQL kodunu yapıştırın:

```sql
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
```

3. **Run** (Çalıştır) butonuna basın
4. "Success. No rows returned" mesajını görmelisiniz

### 3. Doğrulama (Opsiyonel)
Policy'nin başarıyla oluşturulduğunu kontrol etmek için:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'role_permissions'
ORDER BY policyname;
```

Bu sorgu çalıştırıldığında "Users can view their company permissions" adlı bir policy görmelisiniz.

### 4. Frontend'i Yeniden Başlatın
1. Terminal'de çalışan `npm run dev` sürecini durdurun (Ctrl+C)
2. Tekrar başlatın: `npm run dev`

### 5. Test Edin
1. Kullanıcı hesabıyla çıkış yapın ve tekrar giriş yapın
2. Sidebar'da sadece izin verilen modüllerin göründüğünü kontrol edin
3. İzin matrisinde değişiklik yapıp test edin

## Teknik Detaylar

### Ne Değişti?
- **Önceki Durum**: `PermissionsContext`, izinleri `get_company_permissions` RPC fonksiyonundan çekiyordu. Bu fonksiyon sadece superadmin ve admin rollerine izin veriyordu.
- **Yeni Durum**: Frontend artık `role_permissions` tablosundan doğrudan veri çekiyor. Yeni RLS policy sayesinde kullanıcılar kendi şirketlerinin izinlerini okuyabiliyor.

### Değişen Dosyalar
1. `src/contexts/PermissionsContext.tsx` - Artık doğrudan tablodan sorgu yapıyor
2. `supabase/migrations/20250107_allow_users_view_permissions.sql` - Yeni RLS policy (manuel uygulanacak)

## Sorun Devam Ederse

Eğer yukarıdaki adımları uyguladıktan sonra sorun devam ederse:

1. **Browser Console'u Kontrol Edin**:
   - F12 tuşuna basın
   - Console sekmesine gidin
   - "Permissions fetch failed" gibi hata mesajları arayın

2. **Network Sekmesini Kontrol Edin**:
   - F12 > Network sekmesi
   - Sayfayı yenileyin
   - `role_permissions` içeren istekleri bulun
   - Status code 200 olmalı (401 veya 403 değil)

3. **Cache Temizleyin**:
   - Tarayıcı cache'ini temizleyin
   - Hard refresh yapın (Ctrl+Shift+R)

## İletişim
Sorun devam ederse lütfen şu bilgileri paylaşın:
- Browser console'daki hata mesajları
- Network sekmesindeki `role_permissions` isteğinin response'u
- Hangi kullanıcı rolüyle test ettiğiniz
