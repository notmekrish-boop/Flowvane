import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProjectDetails from "./pages/ProjectDetails";
import Team from "./pages/Team";
import AiAssistant from "./pages/AiAssistant";
import Notes from "./pages/Notes";
import DiagramStudio from "./pages/DiagramStudio";
import Workspaces from "./pages/Workspaces";
import WorkspaceChat from "./pages/WorkspaceChat";
import DirectMessages from "./pages/DirectMessages";
import MessageSearch from "./pages/MessageSearch";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";

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
        element={token ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/register"
        element={token ? <Navigate to="/" replace /> : <Register />}
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
