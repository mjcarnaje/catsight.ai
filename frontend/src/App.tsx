import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/protected-route";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import ChatPage from "./pages/chat/chat";
import ChatSessionPage from "./pages/chat/chat-session";
import DashboardPage from "./pages/dashboard/dashboard";
import DocumentsPage from "./pages/documents/documents";
import { DocumentViewPage } from "./pages/documents/view-document";
import { SearchPage } from "./pages/search";
import SettingsPage from "./pages/settings/settings";
import { DocumentEditPage } from "./pages/documents/edit-viewer";
import { LandingPage } from "./pages/landing/landing";
import { TermsAndConditionPage } from "./pages/landing/terms-and-condition";
import { PrivacyPolicyPage } from "./pages/landing/privacy-policty";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "./lib/session";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/landing" replace />} />

            {/* Public Landing Pages - No Layout/Sidebar */}
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditionPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

            {/* Auth & Protected Pages - With Layout */}
            <Route element={<Layout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <DashboardPage />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <DocumentsPage />
                    </div>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/documents/:id"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <DocumentViewPage />
                    </div>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/documents/:id/edit"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <DocumentEditPage />
                    </div>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/:id"
                element={
                  <ProtectedRoute>
                    <ChatSessionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <SearchPage />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <div className="p-8">
                      <SettingsPage />
                    </div>
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
          <Toaster />
        </Router>
      </SessionProvider>
    </QueryClientProvider>
  );
}
