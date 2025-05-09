import { User } from "./index";

/**
 * Represents an LLM model in the system
 */
export interface LLMModel {
  id: number;
  code: string;
  name: string;
  description: string;
  logo: string;
}

/**
 * Model for the frontend components
 */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  isFavorite?: boolean;
  logo?: string;
}

/**
 * Response when updating favorites
 */
export interface UpdateFavoritesResponse {
  success: boolean;
  message: string;
  user: User;
}

/**
 * Constants for common LLM models
 */
export const LLM_MODELS = {
  LLAMA_3_2_1B: "llama3.2:1b",
  DEEPSEEK_R1_1_5B: "deepseek-r1:1.5b",
};
