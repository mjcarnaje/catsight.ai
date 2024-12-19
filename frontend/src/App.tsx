import { Layout } from "@/components/layout";
import { ChatPage } from "@/pages/chat";
import { DocumentsPage } from "@/pages/documents";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { DocumentPage } from "./pages/document";
import { DocumentMarkdownPage } from "./pages/document-markdown";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/documents/:id/raw" element={<DocumentPage />} />
          <Route
            path="/documents/:id/markdown"
            element={<DocumentMarkdownPage />}
          />
          <Route path="/chat" element={<ChatPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
