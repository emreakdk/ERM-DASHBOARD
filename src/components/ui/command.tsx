import * as React from "react"

import { cn } from "../../lib/utils"
import { Input } from "./input"

type CommandContextValue = {
  query: string
  setQuery: (q: string) => void
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommandContext() {
  const ctx = React.useContext(CommandContext)
  if (!ctx) throw new Error("Command bileşenleri Command içinde kullanılmalı")
  return ctx
}

const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: string; onValueChange?: (v: string) => void }
>(({ className, value, onValueChange, ...props }, ref) => {
  const [internal, setInternal] = React.useState("")
  const query = value ?? internal

  const setQuery = (q: string) => {
    onValueChange?.(q)
    if (value === undefined) setInternal(q)
  }

  return (
    <CommandContext.Provider value={{ query, setQuery }}>
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
          className
        )}
        {...props}
      />
    </CommandContext.Provider>
  )
})
Command.displayName = "Command"

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input>
>(({ className, onChange, ...props }, ref) => {
  const { query, setQuery } = useCommandContext()

  return (
    <div className="flex items-center border-b px-3">
      <Input
        ref={ref}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange?.(e)
        }}
        className={cn(
          "h-10 border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0",
          className
        )}
        {...props}
      />
    </div>
  )
})
CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="listbox"
    className={cn("max-h-64 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))
CommandList.displayName = "CommandList"

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-6 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
))
CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { heading?: string }
>(({ className, heading, ...props }, ref) => (
  <div ref={ref} className={cn("p-1", className)}>
    {heading ? (
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {heading}
      </div>
    ) : null}
    <div {...props} />
  </div>
))
CommandGroup.displayName = "CommandGroup"

const CommandItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="option"
    aria-selected={selected}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
      selected && "bg-accent text-accent-foreground",
      className
    )}
    {...props}
  />
))
CommandItem.displayName = "CommandItem"

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
