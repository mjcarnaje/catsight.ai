import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import { Lazy, ProtectedRoute, PublicOnlyRoute } from "@/components/protected-route";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/contexts/session-context";
import { LandingPage } from "@/pages/landing/landing";
import { PrivacyPolicyPage } from "@/pages/landing/privacy-policty";
import { TermsAndConditionPage } from "@/pages/landing/terms-and-condition";

// The landing page ships in the main bundle; the app loads per page on demand
const LoginPage = lazy(() => import("@/pages/auth/login"));
const RegisterPage = lazy(() => import("@/pages/auth/register"));
const DashboardPage = lazy(() => import("@/pages/dashboard/dashboard"));
const ChatPage = lazy(() => import("@/pages/chat/chat"));
const DocumentsPage = lazy(() => import("@/pages/documents/documents"));
const DocumentPage = lazy(() => import("@/pages/documents/document"));
const SearchPage = lazy(() => import("@/pages/search/search"));
const TagsPage = lazy(() => import("@/pages/tags/tags"));
const SettingsPage = lazy(() => import("@/pages/settings/settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditionPage />} />
              <Route path="/login" element={<PublicOnlyRoute><Lazy><LoginPage /></Lazy></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><Lazy><RegisterPage /></Lazy></PublicOnlyRoute>} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id" element={<DocumentPage />} />
                <Route path="/search" element={<SearchPage />} />
                {/* One route so a new chat keeps its state when it gets an id */}
                <Route path="/chat/:id?" element={<ChatPage />} />
                <Route path="/tags" element={<TagsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </BrowserRouter>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
