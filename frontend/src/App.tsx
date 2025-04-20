import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { Route, BrowserRouter as Router, Routes, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/protected-route";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import ChatPage from "./pages/chat/chat";
import ChatSessionPage from "./pages/chat/chat-session";
import DashboardPage from "./pages/dashboard/dashboard";
import DocumentsPage from "./pages/documents";
import { SearchPage } from "./pages/search";
import SettingsPage from "./pages/settings/settings";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
  );
}
