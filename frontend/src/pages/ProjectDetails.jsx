
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FolderKanban,
  CheckCircle2,
  Clock,
  Circle,
  CalendarDays,
  Pencil,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

const statusLabels = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed"
};

const priorityColors = {
  HIGH: "bg-red-100 text-red-600",
  MEDIUM: "bg-orange-100 text-orange-600",
  LOW: "bg-green-100 text-green-600"
};

function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showEditForm, setShowEditForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

  // Fetch project details
  useEffect(() => {
    async function fetchProjectDetails() {
      setLoading(true);
      setError("");

      try {
        const result = await apiRequest(`/projects/${id}`);

        setProject(result.project);
        setTasks(result.project.tasks || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token && id) {
      fetchProjectDetails();
    }
  }, [token, id]);

  // Open edit form
  function handleEditClick() {
    setName(project.name);
    setDescription(project.description || "");
    setShowEditForm(true);
    setError("");
  }

  // Cancel editing
  function handleCancelEdit() {
    setShowEditForm(false);
    setName("");
    setDescription("");
    setError("");
  }

  // Save project changes
  async function handleUpdateProject(e) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await apiRequest(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null
        })
      });

      setProject((previousProject) => ({
        ...previousProject,
        ...result.project
      }));

      setShowEditForm(false);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status !== "COMPLETED"
  ).length;

  const progress = tasks.length > 0
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        Loading project details...
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-2 text-blue-600 mb-6"
        >
          <ArrowLeft size={18} />
          Back to Projects
        </button>

        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4">
          {error}
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="p-8">

      {/* Back Button */}
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6"
      >
        <ArrowLeft size={18} />
        Back to Projects
      </button>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {/* Project Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-7 mb-8">

        <div className="flex justify-between items-start gap-4">

          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-4 rounded-xl">
              <FolderKanban size={28} className="text-blue-600" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                {project.name}
              </h1>

              <p className="text-slate-500 mt-2">
                {project.description || "No description provided."}
              </p>

              <p className="text-xs text-slate-400 mt-3">
                Created: {new Date(project.createdAt).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shrink-0"
          >
            <Pencil size={16} />
            Edit Project
          </button>

        </div>
      </div>

      {/* Edit Project Form */}
      {showEditForm && (
        <form
          onSubmit={handleUpdateProject}
          className="bg-white border border-slate-200 rounded-2xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-800 mb-5">
            Edit Project Details
          </h2>

          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Project Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                maxLength={100}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project"
                rows="3"
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div className="flex gap-3">

              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex items-center gap-2 border border-slate-200 px-5 py-3 rounded-xl hover:bg-slate-50"
              >
                <X size={17} />
                Cancel
              </button>

            </div>
          </div>
        </form>
      )}

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex justify-between">
            <p className="text-slate-500">Total Tasks</p>
            <Circle className="text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold mt-4">{tasks.length}</h2>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex justify-between">
            <p className="text-slate-500">Pending Tasks</p>
            <Clock className="text-orange-500" />
          </div>
          <h2 className="text-3xl font-bold mt-4">{pendingTasks}</h2>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex justify-between">
            <p className="text-slate-500">Completed Tasks</p>
            <CheckCircle2 className="text-green-600" />
          </div>
          <h2 className="text-3xl font-bold mt-4">{completedTasks}</h2>
        </div>

      </div>

      {/* Progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <div className="flex justify-between mb-3">
          <h2 className="font-bold text-slate-800">
            Project Progress
          </h2>

          <span className="font-semibold text-blue-600">
            {progress}%
          </span>
        </div>

        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Project Tasks */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            Project Tasks
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            All tasks associated with this project.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <Circle size={36} className="mx-auto text-slate-300" />
            <p className="text-slate-500 mt-4">
              No tasks have been added to this project yet.
            </p>

            <button
              onClick={() => navigate("/tasks")}
              className="mt-4 text-blue-600 hover:underline"
            >
              Go to My Tasks
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border border-slate-200 rounded-xl p-4"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-sm text-slate-500 mt-1">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <span className={`text-xs px-3 py-1 rounded-full ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
                  <span className="bg-slate-100 px-3 py-1 rounded-full">
                    {statusLabels[task.status]}
                  </span>

                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={14} />
                      {new Date(task.dueDate).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default ProjectDetails;
