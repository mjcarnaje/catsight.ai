"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LLMModel } from "@/types";
import { Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

interface ModelSelectorProps {
  models: LLMModel[];
  selectedModel: LLMModel;
  onModelChange: (model: LLMModel) => void;
  isLoading: boolean;
  error: string | null;
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  isLoading,
  error,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  if (isLoading || !selectedModel) {
    return (
      <div className="flex items-center gap-1.5 h-10 px-4 py-2 text-sm font-medium bg-background border rounded-md text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 h-10 px-4 py-2 text-sm font-medium bg-red-50 rounded-md text-red-700">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between w-full h-10 transition-all", {
            "ring-1 ring-primary": selectedModel,
          })}
          type="button"
        >
          <div className="flex items-center gap-2">
            {selectedModel.logo ? (
              <img
                src={selectedModel.logo}
                alt={selectedModel.name}
                className="object-contain w-4 h-4"
              />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
            <span className="truncate">{selectedModel.name}</span>
          </div>
          <ChevronDown className="w-4 h-4 ml-1 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-96 p-0 rounded-lg border shadow-lg"
        align="start"
      >
        <Command>
          <CommandGroup>
            <CommandInput placeholder="Search models..." className="h-9" />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.name}
                    onSelect={() => onModelChange(model)}
                    className="flex flex-col items-start p-3 transition-colors cursor-pointer hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {model.logo ? (
                          <img
                            src={model.logo}
                            alt={model.name}
                            className="object-contain w-4 h-4"
                          />
                        ) : (
                          <Sparkles className="w-4 h-4 text-primary" />
                        )}
                        <span className="font-medium">{model.name}</span>
                      </div>
                      {selectedModel.id === model.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    {model.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {model.description}
                      </p>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
