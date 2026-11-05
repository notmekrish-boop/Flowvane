import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { API_URL } from "../lib/api.js";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { token } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => localStorage.getItem("taskpilot-workspace"));
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Workspace request failed.");
    return result;
  }, [token]);

  const refreshWorkspaces = useCallback(async () => {
    if (!token) {
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
      localStorage.removeItem("taskpilot-workspace");
      return [];
    }
    setLoadingWorkspaces(true);
    setWorkspaceError("");
    try {
      const result = await request("/workspaces");
      const next = result.workspaces || [];
      setWorkspaces(next);
      const savedId = localStorage.getItem("taskpilot-workspace");
      const selectedId = next.some((workspace) => workspace.id === savedId) ? savedId : next[0]?.id || null;
      setActiveWorkspaceIdState(selectedId);
      if (selectedId) localStorage.setItem("taskpilot-workspace", selectedId);
      else localStorage.removeItem("taskpilot-workspace");
      return next;
    } catch (error) {
      setWorkspaceError(error.message);
      return [];
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [request, token]);

  useEffect(() => { refreshWorkspaces(); }, [refreshWorkspaces]);

  const selectWorkspace = useCallback((id) => {
    setActiveWorkspaceIdState(id);
    if (id) localStorage.setItem("taskpilot-workspace", id);
    else localStorage.removeItem("taskpilot-workspace");
  }, []);

  const createWorkspace = useCallback(async (name) => {
    const result = await request("/workspaces", { method: "POST", body: JSON.stringify({ name }) });
    await refreshWorkspaces();
    selectWorkspace(result.workspace.id);
    return result.workspace;
  }, [refreshWorkspaces, request, selectWorkspace]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const value = useMemo(() => ({
    workspaces, activeWorkspace, activeWorkspaceId, selectWorkspace,
    loadingWorkspaces, workspaceError, refreshWorkspaces, createWorkspace, request
  }), [workspaces, activeWorkspace, activeWorkspaceId, selectWorkspace, loadingWorkspaces, workspaceError, refreshWorkspaces, createWorkspace, request]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider.");
  return context;
}
