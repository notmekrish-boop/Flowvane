
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  Plus,
  Trash2,
  FolderKanban,
  X
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

function Projects() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

  // Fetch projects and tasks, then calculate progress
  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError("");

      try {
        const [projectResult, taskResult] = await Promise.all([
          apiRequest("/projects"),
          apiRequest("/tasks")
        ]);

        const calculatedProjects = projectResult.projects.map((project) => {
          const projectTasks = taskResult.tasks.filter(
            (task) => task.projectId === project.id
          );

          const completedTasks = projectTasks.filter(
            (task) => task.status === "COMPLETED"
          ).length;

          const progress = projectTasks.length > 0
            ? Math.round((completedTasks / projectTasks.length) * 100)
            : 0;

          return {
            ...project,
            progress
          };
        });

        setProjects(calculatedProjects);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchProjects();
    }
  }, [token]);

  // Create project
  async function handleCreateProject(e) {
    e.preventDefault();

    if (!name.trim() || !description.trim()) return;

    setSaving(true);
    setError("");

    try {
      const result = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim()
        })
      });

      setProjects((previousProjects) => [
        { ...result.project, progress: 0 },
        ...previousProjects
      ]);

      setName("");
      setDescription("");
      setShowForm(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Delete project
  async function handleDeleteProject(id) {
    const confirmed = window.confirm(
      "Are you sure? All tasks inside this project will also be deleted."
    );

    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(`/projects/${id}`, {
        method: "DELETE"
      });

      setProjects((previousProjects) =>
        previousProjects.filter((project) => project.id !== id)
      );

    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        Loading your projects...
      </div>
    );
  }

  return (
    <div className="p-8">

      {/* Page Heading */}
      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            My Projects
          </h1>

          <p className="text-slate-500 mt-2">
            Manage and track all your projects.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "Create Project"}
        </button>

      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {/* Create Project Form */}
      {showForm && (
        <form
          onSubmit={handleCreateProject}
          className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-800 mb-5">
            Create New Project
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
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                required
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
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Project"}
            </button>

          </div>
        </form>
      )}

      {/* Project Count */}
      <p className="text-sm text-slate-500 mb-5">
        Total Projects: <strong>{projects.length}</strong>
      </p>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {projects.map((project) => (

          <div
             key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition"
          >

            <div className="flex justify-between items-start">

              <div className="bg-blue-100 p-3 rounded-xl">
                <FolderKanban className="text-blue-600" size={22} />
              </div>

              <button
                onClick={(e) => {
                e.stopPropagation();
                handleDeleteProject(project.id);
             }}
                className="text-slate-400 hover:text-red-500 transition"
                title="Delete project"
              >
                <Trash2 size={19} />
              </button>

            </div>

            <h2 className="text-lg font-bold text-slate-800 mt-5">
              {project.name}
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              {project.description}
            </p>

            {/* Dynamic Progress */}
            <div className="mt-6">

              <div className="flex justify-between text-sm mb-2">

                <span className="text-slate-500">
                  Progress
                </span>

                <span className="font-semibold">
                  {project.progress}%
                </span>

              </div>

              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />

              </div>

            </div>

            <div className="mt-5">
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Active
              </span>
            </div>

          </div>

        ))}

      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">

          <FolderKanban size={40} className="mx-auto text-slate-400" />

          <h3 className="font-semibold text-slate-700 mt-4">
            No projects yet
          </h3>

          <p className="text-sm text-slate-400 mt-2">
            Create your first project to get started.
          </p>

        </div>
      )}

    </div>
  );
}

export default Projects;
