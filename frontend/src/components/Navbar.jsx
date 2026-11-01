
import { Search, Bell, Plus } from "lucide-react";

function Navbar() {
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">

      {/* Search Bar */}
      <div className="relative w-80">

        <Search
          className="absolute left-3 top-3 text-slate-400"
          size={19}
        />

        <input
          type="text"
          placeholder="Search anything..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
        />

      </div>

      {/* Right Side */}
      <div className="flex items-center gap-5">

        {/* Create Button */}
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition">
          <Plus size={18} />
          Create New
        </button>

        {/* Notifications */}
        <button className="relative text-slate-500 hover:text-blue-600">
          <Bell size={22} />

          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white">
          </span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
            K
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              Krish
            </p>

            <p className="text-xs text-slate-400">
              Administrator
            </p>
          </div>

        </div>

      </div>

    </header>
  );
}

export default Navbar;
