import { useEffect, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  Search,
  StickyNote,
  Users,
  Workflow,
} from "./icons";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

const SIDEBAR_STORAGE_KEY = "taskpilot-sidebar-collapsed-v2";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Projects", icon: FolderKanban, path: "/projects" },
  { name: "My Tasks", icon: CheckSquare, path: "/tasks" },
  { name: "Team", icon: Users, path: "/team" },
  { name: "Workspaces", icon: BriefcaseBusiness, path: "/workspaces" },
  { name: "General Chat", icon: MessageCircle, path: "/chat" },
  { name: "Direct Messages", icon: Mail, path: "/messages" },
  { name: "Search Messages", icon: Search, path: "/search" },
  { name: "AI Assistant", icon: Bot, path: "/ai-assistant" },
  { name: "Notes", icon: StickyNote, path: "/notes" },
  { name: "Diagrams", icon: GitBranch, path: "/diagrams" },
];

function Sidebar() {
  const { logout } = useAuth();
  const { activeWorkspace, activeWorkspaceId, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false",
  );

  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
      return next;
    });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className={`sidebar app-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Main navigation">
      <div className="sidebar-brand-row">
        <button
          type="button"
          onClick={() => navigate("/")}
          title="Go to dashboard"
          aria-label="Flowvane home"
          className="sidebar-brand"
        >
          <span className="sidebar-brand-mark"><Workflow size={21} /></span>
          <span className="sidebar-brand-copy">
            <strong>Flowvane</strong>
            <small>{activeWorkspace?.name || "Workspace"}</small>
          </span>
        </button>
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed ? (
        <div className="sidebar-workspace">
          <label htmlFor="sidebar-workspace">Current workspace</label>
          <select
            id="sidebar-workspace"
            value={activeWorkspaceId || ""}
            onChange={(event) => selectWorkspace(event.target.value)}
            title={activeWorkspace?.name || "Choose workspace"}
          >
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <NavLink to="/workspaces">Manage workspaces</NavLink>
        </div>
      ) : (
        <NavLink className="sidebar-workspace-mark" to="/workspaces" title={activeWorkspace?.name || "Current workspace"} aria-label={`Current workspace: ${activeWorkspace?.name || "Workspace"}`}>
          <BriefcaseBusiness size={18} />
        </NavLink>
      )}

      <p className={`sidebar-section-label ${collapsed ? "sr-only" : ""}`}>Workspace</p>

      <nav className="sidebar-nav">
        {menuItems.map(({ name, icon: Icon, path }) => (
          <NavLink
            key={name}
            to={path}
            end={path === "/"}
            title={collapsed ? name : undefined}
            aria-label={name}
            className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
          >
            <span className="sidebar-link-icon"><Icon size={18} /></span>
            <span className="sidebar-link-label">{name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" onClick={handleLogout} className="sidebar-link sidebar-logout" title={collapsed ? "Logout" : undefined} aria-label="Logout">
          <span className="sidebar-link-icon"><LogOut size={18} /></span>
          <span className="sidebar-link-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
