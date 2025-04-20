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
  favorite_llm_models?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
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
    localStorage.removeItem("user");
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("access_token");
  },
};

// React Query hooks
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      // Handle token format from login response
      const { tokens, user } = data;
      if (tokens) {
        // Backend returns tokens object
        localStorage.setItem("access_token", tokens.access);
        localStorage.setItem("refresh_token", tokens.refresh);
      } else if (data.tokens) {
        // Fallback for direct token access
        localStorage.setItem("access_token", data.tokens.access);
        localStorage.setItem("refresh_token", data.tokens.refresh);
      }
      localStorage.setItem("user", JSON.stringify(user || data.user));
      queryClient.setQueryData(["user"], user || data.user);
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterCredentials) => authApi.register(data),
    onSuccess: (data) => {
      // Handle token format from register response
      const { tokens, user } = data;
      if (tokens) {
        // Backend returns tokens object
        localStorage.setItem("access_token", tokens.access);
        localStorage.setItem("refresh_token", tokens.refresh);
      }
      localStorage.setItem("user", JSON.stringify(user || data.user));
      queryClient.setQueryData(["user"], user || data.user);
    },
  });
};

export const useGoogleAuth = (options?: { onSuccess?: () => void }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => authApi.googleAuth(code),
    onSuccess: (data) => {
      // Handle token format from Google auth response
      const { tokens, user } = data;
      if (tokens) {
        // Backend returns tokens object
        localStorage.setItem("access_token", tokens.access);
        localStorage.setItem("refresh_token", tokens.refresh);
      }
      localStorage.setItem("user", JSON.stringify(user || data.user));
      queryClient.setQueryData(["user"], user || data.user);

      if (options?.onSuccess) {
        options.onSuccess();
      }
    },
  });
};

export const useUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      // Always try to get user from localStorage first
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          return JSON.parse(userStr) as User;
        } catch (e) {
          // If parsing fails, clear the invalid data
          localStorage.removeItem("user");
        }
      }

      // Only attempt to fetch profile if we have a token
      if (localStorage.getItem("access_token")) {
        try {
          const response = await authApi.getProfile();
          // Store the user data for future use
          localStorage.setItem("user", JSON.stringify(response));
          return response;
        } catch (error) {
          // If the request fails, clear auth state to prevent loops
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            authApi.logout();
          }
          throw error;
        }
      }

      // If no user data and no token, throw error
      throw new Error("Not authenticated");
    },
    enabled: authApi.isAuthenticated(),
    retry: false, // Don't retry on failure to prevent loops
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
      const currentUserStr = localStorage.getItem("user");
      if (currentUserStr) {
        try {
          const currentUser = JSON.parse(currentUserStr);
          const newUserData = { ...currentUser, ...updatedUser };
          localStorage.setItem("user", JSON.stringify(newUserData));
          queryClient.setQueryData(["user"], newUserData);
        } catch (e) {
          console.error("Failed to update user in localStorage", e);
        }
      }
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return () => {
    authApi.logout();
    queryClient.removeQueries({ queryKey: ["user"] });
  };
};
