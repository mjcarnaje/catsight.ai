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
