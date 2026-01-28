import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type UnifiedDatePickerProps = {
  value?: Date
  onChange: (date?: Date) => void
  label?: string
}

export function UnifiedDatePicker({ value, onChange, label }: UnifiedDatePickerProps) {
  const { i18n } = useTranslation()
  const locale = useMemo(() => (i18n.language?.startsWith('en') ? enUS : tr), [i18n.language])
  const placeholder = i18n.language?.startsWith('en') ? 'Select date' : 'Tarih Seç'
  const dateFormat = i18n.language?.startsWith('en') ? 'MMM d, yyyy' : 'd MMMM yyyy'

  return (
    <div className="space-y-2">
      {label ? <div className="text-sm font-medium">{label}</div> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, dateFormat, { locale }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar selected={value} onSelect={onChange} locale={locale} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
