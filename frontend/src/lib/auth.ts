import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "./api";

// Types
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  role: string;
  avatar?: string;
  is_onboarded?: boolean;
  favorite_llm_models?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
  password_confirm: string;
}

export interface AuthResponse {
  tokens?: {
    access: string;
    refresh: string;
  };
  user: User;
}

interface GoogleAuthResponse {
  tokens: {
    access_token: string;
    refresh_token: string;
  };
  user: User;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>("/auth/login", credentials).then((res) => res.data),

  register: (data: RegisterCredentials) =>
    api.post<AuthResponse>("/auth/register", data).then((res) => res.data),

  googleAuth: (code: string) => {
    return api
      .post<AuthResponse>("/auth/google", { token: code })
      .then((res) => res.data);
  },

  refreshToken: (refreshToken: string) =>
    api
      .post<{ access: string; refresh: string }>("/auth/token/refresh", {
        refresh: refreshToken,
      })
      .then((res) => res.data),

  getProfile: () => api.get<User>("/auth/profile").then((res) => res.data),

  updateProfile: (data: Partial<User>) =>
    api.patch<User>("/auth/profile", data).then((res) => res.data),

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.dispatchEvent(new Event("storage"));
  },
};

export const useUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      if (localStorage.getItem("access_token")) {
        try {
          const response = await authApi.getProfile();
          return response;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            authApi.logout();
          }
          throw error;
        }
      }
      throw new Error("Not authenticated");
    },
    enabled: !!localStorage.getItem("access_token"),
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData | Partial<User>) => {
      return api
        .patch<User>("/auth/profile", data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((res) => res.data);
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["user"], updatedUser);
    },
  });
};
