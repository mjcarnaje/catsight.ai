import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "./api";
import type {
  AuthResponse,
  RegisterCredentials,
  LoginCredentials,
  GoogleAuthCredentials,
} from "@/types/auth";
import type { User } from "@/types/user";

class AuthAPI {
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        "/auth/register/",
        credentials
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        // Handle structured error responses from Django
        const errors = error.response.data;
        const errorMessage = Object.entries(errors)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        throw new Error(errorMessage);
      }
      throw new Error("Registration failed. Please try again.");
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        "/auth/login/",
        credentials
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error("Login failed. Please try again.");
    }
  }

  async googleAuth(credentials: GoogleAuthCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        "/auth/google/",
        credentials
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error("Google authentication failed. Please try again.");
    }
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ access: string; refresh: string }> {
    return api
      .post<{ access: string; refresh: string }>("/auth/token/refresh", {
        refresh: refreshToken,
      })
      .then((res) => res.data);
  }

  async getProfile(): Promise<User> {
    return api.get<User>("/auth/profile").then((res) => res.data);
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return api.patch<User>("/auth/profile", data).then((res) => res.data);
  }

  async logout(): Promise<void> {
    return api.post("/auth/logout").then((res) => res.data);
  }
}

export const authApi = new AuthAPI();

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
