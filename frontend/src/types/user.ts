export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  avatar: string | null;
  is_onboarded: boolean;
  favorite_llm_models: string[];
}
