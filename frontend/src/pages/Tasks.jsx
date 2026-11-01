
import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import KanbanBoard from "../components/KanbanBoard";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

const statusToUI = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed"
};

const statusToAPI = {
  "To Do": "TODO",
  "In Progress": "IN_PROGRESS",
  "Completed": "COMPLETED"
};

const priorityToUI = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High"
};

function Tasks() {
  const { token } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Something went wrong.");
    }

    return result;
  }

  function formatTask(task) {
    return {
      id: task.id,
      title: task.title,
      description: task.description || "",
      project: task.project?.name || "",
      projectId: task.projectId,
      priority: priorityToUI[task.priority],
      status: statusToUI[task.status],
      dueDate: task.dueDate
    };
  }

  // Fetch projects and tasks
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");

      try {
        const [projectResult, taskResult] = await Promise.all([
          apiRequest("/projects"),
          apiRequest("/tasks")
        ]);

        setProjects(projectResult.projects);

        if (projectResult.projects.length > 0) {
          setProjectId(projectResult.projects[0].id);
        }

        setTasks(taskResult.tasks.map(formatTask));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchData();
  }, [token]);

  // Reset form
  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setDueDate("");
    setEditingTask(null);
    setShowForm(false);
  }

  // Open edit form
  function handleEditTask(task) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(
      task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
    );

    const selectedProject = projects.find(
      (project) => project.name === task.project
    );

    setProjectId(selectedProject?.id || task.projectId || "");
    setShowForm(true);
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Create or update task
  async function handleSubmitTask(e) {
    e.preventDefault();

    if (!title.trim() || !projectId) return;

    setSaving(true);
    setError("");

    try {
      if (editingTask) {
        const result = await apiRequest(`/tasks/${editingTask.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            priority: priority.toUpperCase(),
            dueDate: dueDate || null
          })
        });

        setTasks((previousTasks) =>
          previousTasks.map((task) =>
            task.id === editingTask.id
              ? formatTask({
                  ...result.task,
                  project: {
                    name:
                      projects.find((project) => project.id === projectId)?.name ||
                      task.project
                  },
                  projectId
                })
              : task
          )
        );
      } else {
        const result = await apiRequest(
          `/tasks/projects/${projectId}/tasks`,
          {
            method: "POST",
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim() || null,
              priority: priority.toUpperCase(),
              dueDate: dueDate || null
            })
          }
        );

        const selectedProject = projects.find(
          (project) => project.id === projectId
        );

        const newTask = formatTask({
          ...result.task,
          project: { name: selectedProject.name },
          projectId
        });

        setTasks((previousTasks) => [newTask, ...previousTasks]);
      }

      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Update task status
  async function handleStatusChange(id, newStatus) {
    const previousTasks = tasks;

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, status: newStatus } : task
      )
    );

    try {
      await apiRequest(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusToAPI[newStatus]
        })
      });
    } catch (err) {
      setTasks(previousTasks);
      setError(err.message);
    }
  }

  // Delete task
  async function handleDeleteTask(id) {
    setError("");

    try {
      await apiRequest(`/tasks/${id}`, {
        method: "DELETE"
      });

      setTasks((previousTasks) =>
        previousTasks.filter((task) => task.id !== id)
      );
    } catch (err) {
      setError(err.message);
    }
  }

  const todoCount = tasks.filter(
    (task) => task.status === "To Do"
  ).length;

  const progressCount = tasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        Loading your tasks...
      </div>
    );
  }

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
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setEditingTask(null);
              setTitle("");
              setDescription("");
              setPriority("Medium");
              setDueDate("");
              setShowForm(true);
              setError("");
            }
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "Create Task"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {/* Create/Edit Task Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitTask}
          className="bg-white border border-slate-200 rounded-2xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold mb-5">
            {editingTask ? "Edit Task" : "Create New Task"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm mb-2">Task Title</label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                maxLength={150}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-2">Description</label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your task..."
                rows="3"
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Project</label>

              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                disabled={projects.length === 0}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">Priority</label>

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

            <div>
              <label className="block text-sm mb-2">Due Date</label>

              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                disabled={saving || projects.length === 0}
                className="flex-1 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingTask
                    ? "Save Changes"
                    : "Save Task"}
              </button>

              {editingTask && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-slate-500">To Do</p>
          <h2 className="text-3xl font-bold mt-3">{todoCount}</h2>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-slate-500">In Progress</p>
          <h2 className="text-3xl font-bold mt-3">{progressCount}</h2>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-slate-500">Completed</p>
          <h2 className="text-3xl font-bold mt-3">{completedCount}</h2>
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
          onEditTask={handleEditTask}
        />
      </div>
    </div>
  );
}

export default Tasks;
