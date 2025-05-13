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
import { llmApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ModelInfo } from "@/types";
import { Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ModelSelectorProps {
  modelId?: string | null;
  onModelChange: (model: ModelInfo) => void;
}

export function ModelSelector({ modelId, onModelChange }: ModelSelectorProps) {
  const { data: user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiModels = await llmApi.getAll(true);

        // Transform API models to our ModelInfo type and mark favorites
        const transformedModels: ModelInfo[] = apiModels.map((model) => ({
          id: model.code,
          name: model.name,
          description: model.description,
          logo: model.logo,
          isFavorite: user?.favorite_llm_models?.includes(model.code) || false,
        }));

        // Sort models to show favorites first
        transformedModels.sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.name.localeCompare(b.name);
        });

        setModels(transformedModels);
      } catch (error) {
        console.error("Failed to fetch models:", error);
        setError("Failed to load models. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [user]);

  // Set initial selected model when models are loaded
  useEffect(() => {
    if (models.length && !selectedModel) {
      let initialModel: ModelInfo | undefined;

      // If modelId is provided, try to find it in the models list
      if (modelId) {
        initialModel = models.find((model) => model.id === modelId);
      }

      // If no model with modelId was found or no modelId was provided
      if (!initialModel) {
        // Try to find a favorite model or use the first model
        initialModel = models.find((m) => m.isFavorite) || models[0];
      }

      if (initialModel) {
        setSelectedModel(initialModel);
        onModelChange(initialModel);
      }
    }
  }, [models, modelId, selectedModel, onModelChange]);

  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model);
    onModelChange(model);
    setOpen(false);
  };

  if (loading || !selectedModel) {
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
                    onSelect={() => handleModelSelect(model)}
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
                        {model.isFavorite && (
                          <span className="text-xs text-yellow-500">★</span>
                        )}
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
