import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/protected-route";
import { SessionProvider } from "./lib/session";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import ChatPage from "./pages/chat/chat";
import DashboardPage from "./pages/dashboard/dashboard";
import DocumentsPage from "./pages/documents/documents";
import { DocumentEditPage } from "./pages/documents/edit-viewer";
import { DocumentViewPage } from "./pages/documents/view-document";
import { LandingPage } from "./pages/landing/landing";
import { PrivacyPolicyPage } from "./pages/landing/privacy-policty";
import { TermsAndConditionPage } from "./pages/landing/terms-and-condition";
import { SearchPage } from "./pages/search";
import SettingsPage from "./pages/settings/settings";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Router>
          <Routes>
            {/* Public Landing Pages - No Layout/Sidebar */}
            <Route path="/" element={<LandingPage />} />
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
