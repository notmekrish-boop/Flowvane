
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Bot,
  Settings,
  LogOut,
  Sparkles
} from "lucide-react";

function Sidebar() {

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard
    },
    {
      name: "My Projects",
      icon: FolderKanban
    },
    {
      name: "My Tasks",
      icon: CheckSquare
    },
    {
      name: "Team",
      icon: Users
    },
    {
      name: "AI Assistant",
      icon: Bot
    }
  ];

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col p-5">

      {/* Application Logo */}
      <div className="flex items-center gap-3 mb-10">

        <div className="bg-blue-600 p-2 rounded-xl">
          <Sparkles className="text-white" size={24} />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-800">
            TaskPilot AI
          </h1>

          <p className="text-xs text-slate-400">
            Project Management
          </p>
        </div>

      </div>

      {/* Navigation */}
      <p className="text-xs font-semibold text-slate-400 uppercase mb-4">
        Workspace
      </p>

      <nav className="flex flex-col gap-2">

        {menuItems.map((item) => {

          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                item.name === "Dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >

              <Icon size={19} />

              {item.name}

            </button>
          );

        })}

      </nav>

      {/* Bottom Navigation */}
      <div className="mt-auto flex flex-col gap-2">

        <button className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl">
          <Settings size={19} />
          Settings
        </button>

        <button className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl">
          <LogOut size={19} />
          Logout
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;
