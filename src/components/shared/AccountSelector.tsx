import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '../../lib/utils'
import { formatCurrency } from '../../lib/format'
import { useAccounts } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type AccountRow = Database['public']['Tables']['accounts']['Row']

type AccountSelectorProps = {
  value?: string
  onChange: (value: string) => void
  label?: string
}

const currencySymbols: Record<AccountRow['currency'], string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

function formatBalance(currency: AccountRow['currency'], amount: number) {
  if (currency === 'TRY') return formatCurrency(amount)
  return `${currencySymbols[currency]}${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
}

export function AccountSelector({ value, onChange, label }: AccountSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const accountsQuery = useAccounts()
  const accounts = accountsQuery.data ?? []

  const selected = useMemo(
    () => accounts.find((a) => a.id === value),
    [accounts, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => a.name.toLowerCase().includes(q))
  }, [accounts, query])

  return (
    <div className="space-y-2">
      {label ? <div className="text-sm font-medium">{label}</div> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', !selected && 'text-muted-foreground')}
            disabled={accountsQuery.isLoading || accountsQuery.isError}
          >
            <span className="truncate">
              {selected ? selected.name : accountsQuery.isLoading ? 'Yükleniyor...' : 'Hesap Seç'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <Command value={query} onValueChange={setQuery}>
            <CommandInput placeholder="Hesap ara..." />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>Sonuç bulunamadı</CommandEmpty>
              ) : null}
              <CommandGroup>
                {filtered.map((a) => {
                  const balanceText = formatBalance(a.currency, Number(a.balance ?? 0))
                  const isSelected = a.id === value
                  return (
                    <CommandItem
                      key={a.id}
                      selected={isSelected}
                      onClick={() => {
                        onChange(a.id)
                        setOpen(false)
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{balanceText}</div>
                      </div>
                      <Check className={cn('h-4 w-4 ml-2', isSelected ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {accountsQuery.isError ? (
        <p className="text-sm text-destructive">Hesaplar yüklenemedi</p>
      ) : null}
    </div>
  )
}
