import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns"
import type { Locale } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { cn } from "../../lib/utils"
import { Button } from "./button"

export type CalendarProps = {
  selected?: Date
  onSelect?: (date?: Date) => void
  locale?: Locale
  className?: string
}

export function Calendar({ selected, onSelect, locale, className }: CalendarProps) {
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 })

    const out: Date[] = []
    let d = start
    while (d <= end) {
      out.push(d)
      d = addDays(d, 1)
    }

    return out
  }, [viewDate])

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }).map((_, idx) =>
      format(addDays(start, idx), "EEEEE", { locale })
    )
  }, [locale])

  return (
    <div className={cn("w-[280px]", className)}>
      <div className="flex items-center justify-between px-1 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewDate((d) => subMonths(d, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">
          {format(viewDate, "LLLL yyyy", { locale })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-1">
        {weekdayLabels.map((label, idx) => (
          <div key={idx} className="text-center text-xs text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewDate)
          const isSelected = !!selected && isSameDay(day, selected)
          const isToday = isSameDay(day, new Date())

          return (
            <Button
              key={day.toISOString()}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              size="icon"
              className={cn(
                "h-9 w-9",
                !inMonth && "text-muted-foreground/50",
                isToday && !isSelected && "border border-border"
              )}
              onClick={() => {
                onSelect?.(day)
              }}
            >
              {format(day, "d")}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
