'use client'

import { useEffect, useState } from "react"
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { cn } from "@/lib/utils"
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
import { Button } from "@/components/ui/button"
import { llmApi } from "@/lib/api"
import { useUser } from "@/lib/auth"
import { ModelInfo } from "@/types"

interface ModelSelectorProps {
  modelId?: string | null
  onModelChange: (model: ModelInfo) => void
}

export function ModelSelector({
  modelId,
  onModelChange
}: ModelSelectorProps) {
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
        const apiModels = await llmApi.getAll();

        // Transform API models to our ModelInfo type and mark favorites
        const transformedModels: ModelInfo[] = apiModels.map(model => ({
          id: model.code,
          name: model.name,
          description: model.description,
          logo: model.logo,
          isFavorite: user?.favorite_llm_models?.includes(model.code) || false
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
        initialModel = models.find(model => model.id === modelId);
      }

      // If no model with modelId was found or no modelId was provided
      if (!initialModel) {
        // Try to find a favorite model or use the first model
        initialModel = models.find(m => m.isFavorite) || models[0];
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
      <div className="flex items-center gap-1.5 h-10 px-4 py-2 text-sm font-medium bg-gray-100 rounded-md text-gray-700">
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-[180px] bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            <span className="truncate">{selectedModel.name}</span>
          </div>
          <ChevronDown className="w-4 h-4 ml-1 text-gray-400 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.name}
                  onSelect={() => handleModelSelect(model)}
                  className="flex items-start justify-between py-2 cursor-pointer"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{model.name}</span>
                      {model.isFavorite && (
                        <span className="ml-2 text-xs text-yellow-500">★</span>
                      )}
                    </div>
                    {model.description && (
                      <span className="text-xs text-gray-500 line-clamp-2">{model.description}</span>
                    )}
                  </div>
                  {selectedModel.id === model.id && (
                    <Check className="w-4 h-4 text-pink-500" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
