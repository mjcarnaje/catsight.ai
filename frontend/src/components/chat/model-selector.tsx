'use client'

import { useEffect, useState } from "react"
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { llmApi } from "@/lib/api"
import { useUser } from "@/lib/auth"

export type Model = {
  id: string
  name: string
  description?: string
  isFavorite?: boolean
}

interface ModelSelectorProps {
  modelId?: string | null
  onModelChange: (model: Model) => void
}

export function ModelSelector({
  modelId,
  onModelChange
}: ModelSelectorProps) {
  const { data: user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiModels = await llmApi.getAll();

        // Transform API models to our Model type and mark favorites
        const transformedModels: Model[] = apiModels.map(model => ({
          id: model.code,
          name: model.name,
          description: model.description,
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
      let initialModel: Model | undefined;

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

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    onModelChange(model);
  };

  if (loading || !selectedModel) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-700">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
          {selectedModel.name}
          <ChevronDown className="w-4 h-4 ml-1" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {models.map(model => (
          <DropdownMenuItem
            key={model.id}
            className={cn(
              "flex cursor-pointer items-center justify-between py-2",
              selectedModel.id === model.id && "bg-gray-100"
            )}
            onClick={() => handleModelSelect(model)}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <span className="text-sm font-medium">{model.name}</span>
                {model.isFavorite && (
                  <span className="ml-2 text-xs text-yellow-500">★</span>
                )}
              </div>
              {model.description && (
                <span className="text-xs text-gray-500 line-clamp-3">{model.description}</span>
              )}
            </div>
            {selectedModel.id === model.id && <Check className="w-4 h-4 text-blue-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
