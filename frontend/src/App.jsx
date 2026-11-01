
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";

function App() {

  return (

    <div className="flex min-h-screen bg-slate-50">

      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 min-w-0">

        <Navbar />

        <Dashboard />

      </div>

    </div>

  );

}

export default App;
