
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Bot,
  LogOut,
  Workflow,
  StickyNote,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    { name: "Projects", icon: FolderKanban, path: "/projects" },
    { name: "My Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "Team", icon: Users, path: "/team" },
    { name: "AI Assistant", icon: Bot, path: "/ai-assistant" },
    { name: "Notes", icon: StickyNote, path: "/notes" },
  ];

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar relative flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5">
      {/* Brand */}
      <button
        type="button"
        onClick={() => navigate("/")}
        title="Go to Dashboard"
        className="mb-10 flex items-center gap-3 rounded-xl text-left transition-opacity hover:opacity-80"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100">
          <Workflow size={21} className="text-slate-700" />
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            Flowvane
          </h1>
          <p className="text-xs tracking-wide text-slate-400">
            Workspace
          </p>
        </div>
      </button>

      {/* Navigation */}
      <div className="mb-4 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </p>
      </div>

      <nav className="flex flex-col gap-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "group relative flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-slate-100 text-slate-900 dark:bg-white/[0.07] dark:text-slate-100"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-[#8980FF]" />
                  )}

                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className={
                      isActive
                        ? "text-slate-800 dark:text-slate-200"
                        : "text-slate-400 transition-colors group-hover:text-slate-700"
                    }
                  />

                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-slate-200 pt-5 dark:border-white/[0.07]">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/[0.05] dark:hover:text-red-400"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
