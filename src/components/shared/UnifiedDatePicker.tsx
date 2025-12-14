import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'

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
            {value ? format(value, 'd MMMM yyyy', { locale: tr }) : 'Tarih Seç'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar selected={value} onSelect={onChange} locale={tr} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
