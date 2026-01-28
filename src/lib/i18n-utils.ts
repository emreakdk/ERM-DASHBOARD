import type { TFunction } from 'i18next';

/**
 * Dinamik activity log mesajlarını çeviren utility fonksiyon
 * Örnek: "asd kaydı oluşturuldu" -> "asd record created"
 */
export function translateActivityDescription(
  description: string,
  t: TFunction
): string {
  if (!description) return description;

  // Türkçe pattern'leri tespit et ve çevir
  const patterns = [
    {
      regex: /(.+)\s+kaydı\s+oluşturuldu/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.recordCreated')}`,
    },
    {
      regex: /(.+)\s+kaydı\s+güncellendi/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.recordUpdated')}`,
    },
    {
      regex: /(.+)\s+kaydı\s+silindi/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.recordDeleted')}`,
    },
    {
      regex: /(.+)\s+kullanıcı\s+giriş\s+yaptı/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.userLoggedIn')}`,
    },
    {
      regex: /(.+)\s+kullanıcı\s+çıkış\s+yaptı/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.userLoggedOut')}`,
    },
    {
      regex: /(.+)\s+izin\s+değiştirildi/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.permissionChanged')}`,
    },
    {
      regex: /(.+)\s+durum\s+değiştirildi/i,
      translate: (match: RegExpMatchArray) => `${match[1]} ${t('activities.statusChanged')}`,
    },
    {
      regex: /Kullanıcı rolü değiştirildi:\s*(.+)/i,
      translate: (match: RegExpMatchArray) => t('admin.activityLogMessages.roleChanged', { details: match[1] }),
    },
    {
      regex: /Şirket bilgileri güncellendi:\s*(.+)/i,
      translate: (match: RegExpMatchArray) => t('admin.activityLogMessages.companyUpdated', { name: match[1] }),
    },
    {
      regex: /Yeni şirket oluşturuldu:\s*(.+)/i,
      translate: (match: RegExpMatchArray) => t('admin.activityLogMessages.companyCreated', { name: match[1] }),
    },
    {
      regex: /"(.+)"\s+durumu\s+(.+)\s+olarak güncellendi/i,
      translate: (match: RegExpMatchArray) => t('admin.activityLogMessages.statusChanged', {
        item: match[1],
        status: translateStatus(match[2], t),
      }),
    },
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern.regex);
    if (match) {
      return pattern.translate(match);
    }
  }

  return description;
}

/**
 * Durum değerlerini çeviren utility fonksiyon
 */
export function translateStatus(status: string, t: TFunction): string {
  const statusMap: Record<string, string> = {
    'Aktif': t('status.active'),
    'Pasif': t('status.inactive'),
    'Bekliyor': t('status.pending'),
    'Ödendi': t('status.paid'),
    'Ödenmedi': t('status.unpaid'),
    'Gecikmiş': t('status.overdue'),
    'Taslak': t('status.draft'),
    'Gönderildi': t('status.sent'),
    'Onaylandı': t('status.approved'),
    'Reddedildi': t('status.rejected'),
    'İptal Edildi': t('status.cancelled'),
    'Tamamlandı': t('status.completed'),
    'Devam Ediyor': t('status.inProgress'),
  };

  return statusMap[status] || status;
}

/**
 * Sayıları formatlarken kullanılan utility
 */
export function formatNumber(num: number, locale: string = 'tr-TR'): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Para birimi formatı
 */
export function formatCurrency(
  amount: number,
  currency: string = 'TRY',
  locale: string = 'tr-TR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
