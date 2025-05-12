import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const CURRENT_YEAR = new Date().getFullYear()
const START_YEAR = 1990

interface YearPickerProps {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function YearPicker({
  value,
  onChange,
  placeholder = "Select year...",
  className,
  disabled = false,
}: YearPickerProps) {
  const [open, setOpen] = React.useState(false)

  // Generate years from START_YEAR to current year
  const years = React.useMemo(() => {
    const result = []
    for (let year = CURRENT_YEAR; year >= START_YEAR; year--) {
      result.push({ value: year.toString(), label: year.toString() })
    }
    return result
  }, [])

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          {value
            ? years.find((year) => year.value === value)?.label
            : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search year..." />
          <CommandList>
            <CommandEmpty>No year found.</CommandEmpty>
            <CommandGroup>
              {years.map((year) => (
                <CommandItem
                  key={year.value}
                  value={year.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === year.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {year.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 