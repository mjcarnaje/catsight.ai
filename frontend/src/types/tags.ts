import { User } from "./user";

export interface Tag {
  id: number;
  name: string;
  description: string;
  author: User;
  created_at: string;
  updated_at: string;
}
