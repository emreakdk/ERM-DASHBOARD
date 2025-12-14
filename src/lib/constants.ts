export const TRANSACTION_CATEGORIES = {
  INCOME: [
    'Satış Geliri',
    'Hizmet Geliri',
    'Danışmanlık',
    'Kira Geliri',
    'Faiz Geliri',
    'Diğer Gelir',
  ],
  EXPENSE: [
    'Maaş',
    'Kira',
    'Elektrik',
    'Su',
    'İnternet',
    'Telefon',
    'Ofis Malzemeleri',
    'Pazarlama',
    'Ulaşım',
    'Yemek',
    'Vergi',
    'Sigorta',
    'Bakım-Onarım',
    'Danışmanlık',
    'Yazılım',
    'Diğer Gider',
  ],
} as const

export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const

export const INVOICE_STATUS_LABELS = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  cancelled: 'İptal',
} as const

export const TAX_RATES = [0, 1, 8, 10, 18, 20] as const

export const BANK_ACCOUNTS = [
  'Ziraat Bankası',
  'İş Bankası',
  'Garanti BBVA',
  'Akbank',
  'Yapı Kredi',
  'QNB Finansbank',
  'Denizbank',
  'TEB',
  'Vakıfbank',
  'Halkbank',
  'Nakit',
  'Diğer',
] as const
