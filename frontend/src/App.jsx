import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const Team = lazy(() => import("./pages/Team"));
const AiAssistant = lazy(() => import("./pages/AiAssistant"));
const Notes = lazy(() => import("./pages/Notes"));
const DiagramStudio = lazy(() => import("./pages/DiagramStudio"));
const Workspaces = lazy(() => import("./pages/Workspaces"));
const WorkspaceChat = lazy(() => import("./pages/WorkspaceChat"));
const DirectMessages = lazy(() => import("./pages/DirectMessages"));
const MessageSearch = lazy(() => import("./pages/MessageSearch"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";

function PageFallback() {
  return (
    <div role="status" className="flex min-h-[calc(100vh-5rem)] items-center justify-center gap-3 bg-[var(--fv-bg)] text-sm text-[var(--fv-text-muted)]">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Loading Flowvane…
    </div>
  );
}

function ProtectedLayout() {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Navbar />

        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/team" element={<Team />} />
            <Route path="/workspaces" element={<Workspaces />} />
            <Route path="/chat" element={<WorkspaceChat />} />
            <Route path="/messages" element={<DirectMessages />} />
            <Route path="/search" element={<MessageSearch />} />
            <Route path="/ai-assistant" element={<AiAssistant />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/diagrams" element={<DiagramStudio />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <Suspense fallback={<PageFallback />}><Login /></Suspense>}
      />

      <Route
        path="/register"
        element={token ? <Navigate to="/" replace /> : <Suspense fallback={<PageFallback />}><Register /></Suspense>}
      />

      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
