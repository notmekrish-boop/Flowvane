import { LayoutDashboard, FolderKanban, CheckSquare, Users, Bot, LogOut, Sparkles, StickyNote } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    { name: "My Projects", icon: FolderKanban, path: "/projects" },
    { name: "My Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "Team", icon: Users, path: "/team" },
    { name: "AI Assistant", icon: Bot, path: "/ai-assistant" },
    { name: "Notes", icon: StickyNote, path: "/notes" }
  ];
  function handleLogout() { logout(); navigate("/login", { replace: true }); }
  return (
    <aside className="sidebar w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col p-5 shrink-0">
      <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 mb-10 text-left rounded-xl hover:opacity-80 transition" title="Go to Dashboard">
        <div className="bg-blue-600 p-2 rounded-xl"><Sparkles className="text-white" size={24} /></div>
        <div><h1 className="text-xl font-bold text-slate-800">TaskPilot AI</h1><p className="text-xs text-slate-400">Project Management</p></div>
      </button>
      <p className="text-xs font-semibold text-slate-400 uppercase mb-4">Workspace</p>
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => { const Icon = item.icon; return <NavLink key={item.name} to={item.path} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={19} />{item.name}</NavLink>; })}
      </nav>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl"><LogOut size={19} />Logout</button>
      </div>
    </aside>
  );
}
export default Sidebar;
