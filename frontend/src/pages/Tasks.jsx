
import { useState } from "react";
import { Plus, X } from "lucide-react";
import KanbanBoard from "../components/KanbanBoard";

function Tasks() {

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Design login page",
      project: "Website Redesign",
      priority: "High",
      status: "In Progress"
    },
    {
      id: 2,
      title: "Create database schema",
      project: "Mobile Application",
      priority: "Medium",
      status: "To Do"
    },
    {
      id: 3,
      title: "Review landing page",
      project: "Website Redesign",
      priority: "Low",
      status: "Completed"
    }
  ]);

  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [project, setProject] = useState("Website Redesign");
  const [priority, setPriority] = useState("Medium");

  // Create task
  function handleCreateTask(e) {

    e.preventDefault();

    if (!title.trim()) return;

    const newTask = {
      id: Date.now(),
      title: title.trim(),
      project,
      priority,
      status: "To Do"
    };

    setTasks((previousTasks) => [
      ...previousTasks,
      newTask
    ]);

    setTitle("");
    setPriority("Medium");
    setShowForm(false);
  }

  // Update task status
  function handleStatusChange(id, newStatus) {

    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id
          ? { ...task, status: newStatus }
          : task
      )
    );

  }

  // Delete task
  function handleDeleteTask(id) {

    setTasks((previousTasks) =>
      previousTasks.filter((task) => task.id !== id)
    );

  }

  // Calculate task statistics
  const todoCount = tasks.filter(
    (task) => task.status === "To Do"
  ).length;

  const progressCount = tasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  return (

    <div className="p-8">

      {/* Page Header */}

      <div className="flex justify-between items-center mb-8">

        <div>

          <h1 className="text-3xl font-bold text-slate-800">
            My Tasks
          </h1>

          <p className="text-slate-500 mt-2">
            Organize and track your daily tasks.
          </p>

        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}

          {showForm ? "Close Form" : "Create Task"}

        </button>

      </div>


      {/* Create Task Form */}

      {showForm && (

        <form
          onSubmit={handleCreateTask}
          className="bg-white border border-slate-200 rounded-2xl p-6 mb-8"
        >

          <h2 className="text-xl font-bold mb-5">
            Create New Task
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <div className="md:col-span-3">

              <label className="block text-sm mb-2">
                Task Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />

            </div>

            <div>

              <label className="block text-sm mb-2">
                Project
              </label>

              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                <option>Website Redesign</option>
                <option>Mobile Application</option>
                <option>Marketing Campaign</option>
              </select>

            </div>

            <div>

              <label className="block text-sm mb-2">
                Priority
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>

            </div>

            <div className="flex items-end">

              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700"
              >
                Save Task
              </button>

            </div>

          </div>

        </form>

      )}


      {/* Task Statistics */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

        <div className="bg-white border rounded-2xl p-5">

          <p className="text-slate-500">To Do</p>

          <h2 className="text-3xl font-bold mt-3">
            {todoCount}
          </h2>

        </div>

        <div className="bg-white border rounded-2xl p-5">

          <p className="text-slate-500">In Progress</p>

          <h2 className="text-3xl font-bold mt-3">
            {progressCount}
          </h2>

        </div>

        <div className="bg-white border rounded-2xl p-5">

          <p className="text-slate-500">Completed</p>

          <h2 className="text-3xl font-bold mt-3">
            {completedCount}
          </h2>

        </div>

      </div>


      {/* Kanban Board */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <div className="mb-6">

          <h2 className="text-xl font-bold text-slate-800">
            Task Board
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Drag and drop tasks to update their status.
          </p>

        </div>

        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
        />

      </div>

    </div>

  );

}

export default Tasks;
