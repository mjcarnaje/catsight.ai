import { User } from "./user";

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface RegisterCredentials {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  password: string;
  password_confirm: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface GoogleAuthCredentials {
  token: string;
}
