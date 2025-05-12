import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { Button } from "./button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

export type Option = {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  badgeClassName?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  emptyMessage = "No options found.",
  className,
  badgeClassName,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item))
  }

  // Filter out selected options from the rendered list
  const filteredOptions = options.filter(option =>
    !selected.includes(option.value)
  )

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-h-9 w-full justify-between px-3 py-2",
            selected.length > 0 ? "h-auto" : "h-9",
            className
          )}
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length > 0 ? (
              selected.map((item) => {
                const selectedOption = options.find((option) => option.value === item)
                return (
                  <Badge
                    key={item}
                    variant="secondary"
                    className={cn(
                      "mr-1 mb-1 flex items-center gap-1 py-1 text-xs",
                      badgeClassName
                    )}
                  >
                    {selectedOption?.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnselect(item)
                      }}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {selectedOption?.label}</span>
                    </Button>
                  </Badge>
                )
              })
            ) : (
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search options..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(value) => {
                      onChange([...selected, value])
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 