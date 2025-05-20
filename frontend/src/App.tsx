import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/protected-route";
import { PublicRoute } from "./components/public-route";
import { SessionProvider } from "./contexts/session-context";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import ChatPage from "./pages/chat/chat";
import DashboardPage from "./pages/dashboard/dashboard";
import DocumentsPage from "./pages/documents/documents";
import { EditDocumentPage } from "./pages/documents/edit-document-page";
import { DocumentPdfPage } from "./pages/documents/document-pdf";
import { DocumentMarkdownPage } from "./pages/documents/document-markdown";
import { DocumentComparisonPage } from "./pages/documents/document-comparison";
import { LandingPage } from "./pages/landing/landing";
import { PrivacyPolicyPage } from "./pages/landing/privacy-policty";
import { TermsAndConditionPage } from "./pages/landing/terms-and-condition";
import { SearchPage } from "./pages/search";
import SettingsPage from "./pages/settings/settings";
import { DocumentViewPage } from "./pages/documents/view-document";
import { OnboardingPage } from "./pages/onboarding/onboarding";
import { ChatProvider } from "./contexts/chat-context";
import { ChatStreamProvider } from "./contexts/chat-stream-context";
import { GraphPage } from "./pages/graph/graph-page";
import TagsPage from "./pages/tags/tags";
import { cn } from "./lib/utils";
import DebugPage from "./pages/debug";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <div className="relative">
          <div
            className={cn(
              "absolute inset-0 z-[1] pointer-events-none",
              "[background-size:30px_30px]",
              "[background-image:radial-gradient(#DCDCDC_1px,transparent_1px)]"
            )}
          />
          <Router>
            <ChatProvider>
              <ChatStreamProvider>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route
                    path="/terms-and-conditions"
                    element={<TermsAndConditionPage />}
                  />
                  <Route
                    path="/privacy-policy"
                    element={<PrivacyPolicyPage />}
                  />
                  <Route path="/graph" element={<GraphPage />} />

                  <Route element={<Layout />}>
                    <Route
                      path="/login"
                      element={
                        <PublicRoute>
                          <LoginPage />
                        </PublicRoute>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <PublicRoute>
                          <RegisterPage />
                        </PublicRoute>
                      }
                    />
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-10 p-8">
                            <OnboardingPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-10 p-8">
                            <DashboardPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/documents"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-10 p-8">
                            <DocumentsPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/documents/:id"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-10 w-full max-w-6xl p-8 mx-auto">
                            <DocumentViewPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/documents/:id/edit"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <EditDocumentPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/documents/:id/pdf"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 w-full max-w-6xl p-8 mx-auto">
                            <DocumentPdfPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/documents/:id/markdown"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 w-full max-w-6xl p-8 mx-auto">
                            <DocumentMarkdownPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/documents/:id/comparison"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <DocumentComparisonPage />
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
                          <div className="relative z-20">
                            <ChatPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tags"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <TagsPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/search"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <SearchPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <SettingsPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/debug"
                      element={
                        <ProtectedRoute>
                          <div className="relative z-20 p-8">
                            <DebugPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                  </Route>
                </Routes>
                <Toaster />
              </ChatStreamProvider>
            </ChatProvider>
          </Router>
        </div>
      </SessionProvider>
    </QueryClientProvider>
  );
}
