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

// Fallback models in case API fails
const fallbackModels: Model[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most capable model for complex tasks"
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast responses with good quality"
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    description: "Balanced performance and speed"
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Fast and efficient for simple tasks"
  }
]

interface ModelSelectorProps {
  models?: Model[]
  defaultModelId?: string
  onModelChange: (model: Model) => void
}

export function ModelSelector({
  models: propModels,
  defaultModelId = "gemini-2.5-flash",
  onModelChange
}: ModelSelectorProps) {
  const { data: user } = useUser();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>(propModels || []);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    // If models are provided via props, use them
    if (propModels?.length) {
      setModels(propModels);
      return;
    }

    // Otherwise fetch models from API
    const fetchModels = async () => {
      setLoading(true);
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
        setModels(fallbackModels);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [user, propModels]);

  // Set initial selected model when models are loaded
  useEffect(() => {
    if (models.length && !selectedModel) {
      // First try to find default model
      const defaultModel = models.find(model => model.id === defaultModelId);
      // If default not found, prefer first favorite model or first model
      const initialModel = defaultModel || models.find(m => m.isFavorite) || models[0];
      setSelectedModel(initialModel);
      onModelChange(initialModel);
    }
  }, [models, defaultModelId, selectedModel, onModelChange]);

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none">
          {selectedModel.name}
          <ChevronDown className="w-4 h-4" />
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
