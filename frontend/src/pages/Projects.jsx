import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, FolderKanban, X, Search, ArrowUpDown,
  CheckCircle2, Clock3, LayoutGrid, RefreshCw, Users,
} from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { API_URL } from "../lib/api.js";


function Projects() {
  const { token, user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Something went wrong.");
    return result;
  }

  async function fetchProjects() {
    setLoading(true);
    setError("");
    try {
      const [projectResult, taskResult] = await Promise.all([
        apiRequest("/projects"),
        apiRequest("/tasks"),
      ]);
      const allTasks = taskResult.tasks || [];
      const calculatedProjects = (projectResult.projects || []).map((project) => {
        const projectTasks = allTasks.filter((task) => task.projectId === project.id);
        const completedTasks = projectTasks.filter((task) => task.status === "COMPLETED").length;
        return {
          ...project,
          taskCount: projectTasks.length,
          completedTaskCount: completedTasks,
          progress: projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0,
          canDelete: project.ownerId === user?.id,
        };
      });
      setProjects(calculatedProjects);
    } catch (err) {
      setError(err.message || "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && user) fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  async function handleCreateProject(event) {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim(), workspaceId: activeWorkspaceId }),
      });
      setProjects((previous) => [{
        ...result.project,
        taskCount: 0,
        completedTaskCount: 0,
        progress: 0,
        canDelete: true,
      }, ...previous]);
      setName("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Unable to create project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject(id) {
    const project = projects.find((item) => item.id === id);
    if (!project?.canDelete || deletingId) return;
    if (!window.confirm("Are you sure? All tasks inside this project will also be deleted.")) return;
    setDeletingId(id);
    setError("");
    try {
      await apiRequest(`/projects/${id}`, { method: "DELETE" });
      setProjects((previous) => previous.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "Unable to delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = projects.filter((project) => {
      const matchesSearch = !query ||
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query);
      const completed = project.taskCount > 0 && project.progress === 100;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "completed" && completed) ||
        (statusFilter === "active" && !completed);
      return matchesSearch && matchesStatus;
    });
    return result.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "progress") return b.progress - a.progress;
      if (sortBy === "tasks") return b.taskCount - a.taskCount;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [projects, search, statusFilter, sortBy]);

  const completedProjects = projects.filter((p) => p.taskCount > 0 && p.progress === 100).length;
  const activeProjects = projects.length - completedProjects;

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#F5F5F8] p-5 text-[#686878] dark:bg-[#08090C] dark:text-[#92939E] sm:p-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-4 w-72 rounded bg-slate-200 dark:bg-white/10" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-28 rounded-2xl bg-white dark:bg-[#15161C]" />)}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-64 rounded-2xl bg-white dark:bg-[#15161C]" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F5F5F8] px-5 py-7 text-[#292936] transition-colors dark:bg-[#08090C] dark:text-[#C6C6D0] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#92939E]">
              <FolderKanban size={14} /> Workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#292936] dark:text-[#C6C6D0] sm:text-3xl">Projects</h1>
            <p className="mt-2 text-sm text-[#686878] dark:text-[#92939E]">
              Organise your work, follow progress and keep every project moving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchProjects}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E4EC] bg-white px-4 py-3 text-sm font-medium text-[#555565] transition hover:border-[#C9C8D5] hover:bg-[#FAFAFC] dark:border-[#292A32] dark:bg-[#15161C] dark:text-[#C6C6D0] dark:hover:border-[#41414D] dark:hover:bg-[#1B1C23]">
              <RefreshCw size={16} /> Refresh
            </button>
            <button type="button" onClick={() => { setShowForm((v) => !v); setError(""); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6258E8] px-5 py-3 text-sm font-semibold text-white shadow-[0_5px_18px_rgba(98,88,232,0.16)] transition hover:bg-[#554BD8] focus:outline-none focus:ring-2 focus:ring-[#8980FF] focus:ring-offset-2 focus:ring-offset-[#F5F5F8] dark:focus:ring-offset-[#08090C]">
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "Close form" : "Create project"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="shrink-0 rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-500/10" aria-label="Dismiss error"><X size={16} /></button>
          </div>
        )}

        <section className="mb-7 grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={<LayoutGrid size={18} />} label="Total projects" value={projects.length} detail="Projects you can access" tone="indigo" />
          <SummaryCard icon={<Clock3 size={18} />} label="Active projects" value={activeProjects} detail="Projects still in progress" tone="neutral" />
          <SummaryCard icon={<CheckCircle2 size={18} />} label="Completed projects" value={completedProjects} detail="All tasks completed" tone="green" />
        </section>

        {showForm && (
          <form onSubmit={handleCreateProject} className="mb-7 rounded-2xl border border-[#E4E4EC] bg-white p-5 shadow-sm dark:border-[#292A32] dark:bg-[#15161C] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#292936] dark:text-[#C6C6D0]">Create a project</h2>
                <p className="mt-1 text-sm text-[#686878] dark:text-[#92939E]">Give your project a clear name and a short description.</p>
              </div>
              <span className="rounded-lg bg-[#F0EFFF] p-2.5 text-[#6258E8] dark:bg-[#6258E8]/10 dark:text-[#8980FF]"><FolderKanban size={19} /></span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#555565] dark:text-[#C6C6D0]">Project name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign" maxLength={100} required
                  className="w-full rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-4 py-3 text-sm text-[#292936] outline-none transition placeholder:text-[#A0A0AD] focus:border-[#8A82F0] focus:ring-2 focus:ring-[#6258E8]/10 dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#70717D] dark:focus:border-[#7068FF] dark:focus:ring-[#7068FF]/15" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#555565] dark:text-[#C6C6D0]">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" rows={3} required
                  className="w-full resize-y rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-4 py-3 text-sm text-[#292936] outline-none transition placeholder:text-[#A0A0AD] focus:border-[#8A82F0] focus:ring-2 focus:ring-[#6258E8]/10 dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#70717D] dark:focus:border-[#7068FF] dark:focus:ring-[#7068FF]/15" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setName(""); setDescription(""); }}
                className="rounded-xl border border-[#E4E4EC] px-4 py-2.5 text-sm font-medium text-[#686878] transition hover:bg-[#F5F5F8] dark:border-[#34353F] dark:text-[#A5A6B0] dark:hover:bg-white/5">Cancel</button>
              <button type="submit" disabled={saving || !name.trim() || !description.trim()}
                className="rounded-xl bg-[#6258E8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#554BD8] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Creating..." : "Create project"}</button>
            </div>
          </form>
        )}

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E4E4EC] bg-white p-4 dark:border-[#292A32] dark:bg-[#15161C] sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#92939E]" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..."
              className="w-full rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] py-2.5 pl-10 pr-4 text-sm text-[#292936] outline-none transition placeholder:text-[#A0A0AD] focus:border-[#8A82F0] dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#70717D] dark:focus:border-[#7068FF]" />
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter projects by status"
              className="min-w-36 flex-1 rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-3 py-2.5 text-sm text-[#555565] outline-none focus:border-[#8A82F0] dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0] sm:flex-none">
              <option value="all">All projects</option><option value="active">Active</option><option value="completed">Completed</option>
            </select>
            <div className="relative flex-1 sm:flex-none">
              <ArrowUpDown size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92939E]" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort projects"
                className="w-full min-w-44 rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] py-2.5 pl-9 pr-3 text-sm text-[#555565] outline-none focus:border-[#8A82F0] dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0]">
                <option value="recent">Recently created</option><option value="name">Name: A to Z</option><option value="progress">Highest progress</option><option value="tasks">Most tasks</option>
              </select>
            </div>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[#686878] dark:text-[#92939E]">
            Showing <span className="font-semibold text-[#292936] dark:text-[#C6C6D0]">{filteredProjects.length}</span> of <span className="font-semibold text-[#292936] dark:text-[#C6C6D0]">{projects.length}</span> projects
          </p>
          {(search || statusFilter !== "all") && (
            <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="text-xs font-medium text-[#6258E8] hover:text-[#5045D5] dark:text-[#8980FF] dark:hover:text-[#A49EFF]">Clear filters</button>
          )}
        </div>

        {filteredProjects.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <article key={project.id} role="link" tabIndex={0}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/projects/${project.id}`); } }}
                className="group flex min-h-64 cursor-pointer flex-col rounded-2xl border border-[#E4E4EC] bg-white p-5 shadow-[0_2px_8px_rgba(25,25,40,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#C9C5FA] hover:shadow-[0_10px_28px_rgba(25,25,40,0.07)] focus:outline-none focus:ring-2 focus:ring-[#6258E8]/30 dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none dark:hover:border-[#6258E8]/50 dark:hover:bg-[#181920] dark:hover:shadow-[0_0_24px_rgba(98,88,232,0.07)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl border border-[#E7E5FF] bg-[#F0EFFF] p-3 text-[#6258E8] dark:border-[#7068FF]/15 dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><FolderKanban size={21} /></div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#E5E5EC] bg-[#F7F7FA] px-2.5 py-1 text-[11px] font-medium text-[#686878] dark:border-[#34353F] dark:bg-[#202129] dark:text-[#A5A6B0]">{project.ownerId === user?.id ? "Owner" : "Shared"}</span>
                    {project.canDelete && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} disabled={deletingId === project.id}
                        className="rounded-lg p-2 text-[#92939E] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title="Delete project" aria-label={`Delete ${project.name}`}>
                        {deletingId === project.id ? <span className="block h-[17px] w-[17px] animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 size={17} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <h2 className="line-clamp-1 text-lg font-semibold text-[#292936] transition-colors group-hover:text-[#6258E8] dark:text-[#C6C6D0] dark:group-hover:text-[#A49EFF]">{project.name}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#686878] dark:text-[#92939E]">{project.description || "No description provided."}</p>
                </div>
                <div className="mt-auto pt-6">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[#686878] dark:text-[#92939E]">Project progress</span>
                    <span className="font-semibold tabular-nums text-[#292936] dark:text-[#C6C6D0]">{project.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ECECF1] dark:bg-[#292A32]" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress}>
                    <div className="h-full rounded-full bg-[#6258E8] transition-all duration-500 dark:bg-[#7068FF]" style={{ width: `${project.progress}%` }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#EEEEF2] pt-3 text-xs dark:border-[#292A32]">
                    <span className="inline-flex items-center gap-1.5 text-[#686878] dark:text-[#92939E]"><CheckCircle2 size={14} />{project.completedTaskCount} / {project.taskCount} tasks completed</span>
                    <span className="inline-flex items-center gap-1 text-[#92939E]"><Users size={13} />{project._count?.members ?? project.members?.length ?? "—"}</span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#DADAE4] bg-white px-6 py-14 text-center dark:border-[#34353F] dark:bg-[#15161C]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EFFF] text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><FolderKanban size={25} /></div>
            <h2 className="mt-4 text-lg font-semibold text-[#292936] dark:text-[#C6C6D0]">{projects.length === 0 ? "No projects yet" : "No matching projects"}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#686878] dark:text-[#92939E]">
              {projects.length === 0 ? "Create your first project to bring tasks, people and progress together." : "Try another search or clear your filters to see your projects."}
            </p>
            {projects.length === 0 ? (
              <button type="button" onClick={() => setShowForm(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6258E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#554BD8]"><Plus size={16} />Create your first project</button>
            ) : (
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-5 text-sm font-semibold text-[#6258E8] hover:text-[#5045D5] dark:text-[#8980FF]">Clear filters</button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail, tone }) {
  const tones = {
    indigo: "border-[#E7E5FF] bg-[#F0EFFF] text-[#6258E8] dark:border-[#7068FF]/15 dark:bg-[#7068FF]/10 dark:text-[#A49EFF]",
    neutral: "border-[#E8E8ED] bg-[#F4F4F7] text-[#686878] dark:border-[#34353F] dark:bg-[#202129] dark:text-[#A5A6B0]",
    green: "border-green-100 bg-green-50 text-green-600 dark:border-green-500/15 dark:bg-green-500/10 dark:text-green-400",
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E4E4EC] bg-white p-4 shadow-[0_2px_8px_rgba(25,25,40,0.025)] dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#686878] dark:text-[#92939E]">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-[#292936] dark:text-[#C6C6D0]">{value}</p>
        <p className="mt-1 text-[11px] text-[#92939E]">{detail}</p>
      </div>
      <div className={`shrink-0 rounded-xl border p-3 ${tones[tone] || tones.neutral}`}>{icon}</div>
    </div>
  );
}

export default Projects;
