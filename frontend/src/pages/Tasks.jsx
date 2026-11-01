
import { useState } from "react";

import {
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Circle
} from "lucide-react";

function Tasks() {

  // Initial task data
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

    setTasks([...tasks, newTask]);

    setTitle("");
    setPriority("Medium");
    setShowForm(false);
  }

  // Update task status
  function handleStatusChange(id, newStatus) {

    setTasks(
      tasks.map((task) =>
        task.id === id
          ? { ...task, status: newStatus }
          : task
      )
    );

  }

  // Delete task
  function handleDeleteTask(id) {

    setTasks(
      tasks.filter((task) => task.id !== id)
    );

  }

  // Status icons
  const statusIcons = {
    "To Do": Circle,
    "In Progress": Clock,
    "Completed": CheckCircle2
  };

  // Priority colors
  const priorityColors = {
    High: "bg-red-100 text-red-600",
    Medium: "bg-orange-100 text-orange-600",
    Low: "bg-green-100 text-green-600"
  };

  return (

    <div className="p-8">

      {/* Header */}
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

            {/* Task title */}
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
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

            {/* Project */}
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

            {/* Priority */}
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

            {/* Submit */}
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

        {["To Do", "In Progress", "Completed"].map((status) => {

          const count = tasks.filter(
            (task) => task.status === status
          ).length;

          return (

            <div
              key={status}
              className="bg-white border border-slate-200 rounded-2xl p-5"
            >

              <p className="text-sm text-slate-500">
                {status}
              </p>

              <h2 className="text-3xl font-bold text-slate-800 mt-3">
                {count}
              </h2>

            </div>

          );

        })}

      </div>


      {/* Task List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <h2 className="text-xl font-bold text-slate-800 mb-5">
          All Tasks ({tasks.length})
        </h2>

        <div className="space-y-4">

          {tasks.map((task) => {

            const StatusIcon = statusIcons[task.status];

            return (

              <div
                key={task.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 py-4"
              >

                <div className="flex items-start gap-3">

                  <StatusIcon
                    size={22}
                    className="text-blue-600 mt-1"
                  />

                  <div>

                    <h3 className="font-semibold text-slate-800">
                      {task.title}
                    </h3>

                    <p className="text-sm text-slate-400 mt-1">
                      {task.project}
                    </p>

                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs ${priorityColors[task.priority]}`}>
                      {task.priority} Priority
                    </span>

                  </div>

                </div>


                <div className="flex items-center gap-4">

                  {/* Change status */}
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleStatusChange(task.id, e.target.value)
                    }
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >

                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Completed</option>

                  </select>


                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-slate-400 hover:text-red-500"
                    title="Delete task"
                  >
                    <Trash2 size={19} />
                  </button>

                </div>

              </div>

            );

          })}

        </div>

        {tasks.length === 0 && (
          <p className="text-center text-slate-400 py-8">
            No tasks available. Create your first task!
          </p>
        )}

      </div>

    </div>

  );

}

export default Tasks;
