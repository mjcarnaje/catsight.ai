import { User } from "./user";

/**
 * Represents an LLM model in the system
 */
export interface LLMModel {
  id: number;
  name: string;
  code: string;
  description: string;
  logo: string;
  instruct: boolean;
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
