import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { organizationApi } from "@/lib/api";
import type { OrgRole } from "@/types";

/** The JSON body of an API error (`{detail, code}`, plus extras such as `documents` on reindex_required). */
export function apiErrorBody(error: unknown): { code?: string; [key: string]: unknown } | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data;
  return data && typeof data === "object" ? (data as { code?: string; [key: string]: unknown }) : undefined;
}

/** The backend's machine-readable error code (400 last_admin, 409 already_used, 410 expired, ...). */
export function apiErrorCode(error: unknown): string | undefined {
  const code = apiErrorBody(error)?.code;
  return typeof code === "string" ? code : undefined;
}

export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/** Query keys for the organization administration screens. The cache is cleared on every organization switch. */
export const orgAdminKeys = {
  members: ["organization", "members"] as const,
  invitations: ["organization", "invitations"] as const,
  ai: ["organization", "ai"] as const,
  invitation: (token: string) => ["invitation", token] as const,
  organizations: ["admin", "organizations"] as const,
};

/** The organization's members. Only admins can read them (the API answers 403 to everyone else). */
export function useMembers(enabled: boolean) {
  return useQuery({ queryKey: orgAdminKeys.members, queryFn: organizationApi.members, enabled });
}

/** The organization's invitations (admins only, like the members). */
export function useInvitations(enabled: boolean) {
  return useQuery({ queryKey: orgAdminKeys.invitations, queryFn: organizationApi.invitations, enabled });
}

export const ROLE_LABELS: Record<OrgRole, string> = { admin: "Admin", member: "Member", guest: "Guest" };

export function fullName(user: { first_name: string; last_name: string; email: string }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
}

/** Two letters for an avatar fallback. */
export function initialsOf(user: { first_name: string; last_name: string; email: string }) {
  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
  return initials || (user.email[0] ?? "?").toUpperCase();
}
