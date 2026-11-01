
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";

function App() {

  return (

    <BrowserRouter>

      <div className="flex min-h-screen bg-slate-50">

        <Sidebar />

        <div className="flex-1 min-w-0">

          <Navbar />

          <Routes>

            <Route path="/" element={<Dashboard />} />

            <Route path="/projects" element={<Projects />} />

            <Route path="/tasks" element={<Tasks />} />

          </Routes>

        </div>

      </div>

    </BrowserRouter>

  );
}

export default App;
