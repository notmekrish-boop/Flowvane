import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock3,
  Filter,
  ListTodo,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import KanbanBoard from "../components/KanbanBoard";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

const STATUS_TO_UI = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const STATUS_TO_API = {
  "To Do": "TODO",
  "In Progress": "IN_PROGRESS",
  Completed: "COMPLETED",
};

const PRIORITY_TO_UI = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };

const inputClass =
  "w-full rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] px-4 py-3 text-sm text-[var(--fv-text)] outline-none transition placeholder:text-[var(--fv-text-muted)] focus:border-[var(--fv-accent)] focus:ring-2 focus:ring-[var(--fv-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

const panelClass =
  "rounded-2xl border border-[var(--fv-border)] bg-[var(--fv-surface)]";

function isProjectAdmin(project, userId) {
  if (!project || !userId) return false;

  return (
    project.ownerId === userId ||
    project.members?.some(
      (member) => member.role === "ADMIN"
    ) ||
    false
  );
}

function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(value, status) {
  if (!value || status === "Completed") return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function StatCard({ label, value, detail, icon: Icon, tone = "neutral" }) {
  const toneClasses = {
    neutral: "bg-[var(--fv-accent-soft)] text-[var(--fv-text)]",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-rose-500/10 text-rose-500",
  };

  return (
    <div className={`${panelClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--fv-text-secondary)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--fv-text)]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[var(--fv-text-muted)]">{detail}</p>
        </div>
        <span className={`rounded-xl p-3 ${toneClasses[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

function PriorityPill({ priority }) {
  const classes = {
    High: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    Medium: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    Low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        classes[priority] || classes.Medium
      }`}
    >
      {priority}
    </span>
  );
}

function StatusPill({ status }) {
  const classes = {
    "To Do": "border-[var(--fv-border)] bg-[var(--fv-bg)] text-[var(--fv-text-secondary)]",
    "In Progress": "border-sky-500/20 bg-sky-500/10 text-sky-500",
    Completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        classes[status] || classes["To Do"]
      }`}
    >
      {status === "Completed" ? (
        <Check size={12} />
      ) : status === "In Progress" ? (
        <Clock3 size={12} />
      ) : (
        <Circle size={10} />
      )}
      {status}
    </span>
  );
}

function Tasks() {
  const { token, user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskView, setTaskView] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("IN_PROGRESS");
  const [bulkSaving, setBulkSaving] = useState(false);

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || "Something went wrong.");
    }
    return result;
  }

  function formatTask(task) {
    const project = task.project || {};
    const canManage = isProjectAdmin(project, user?.id);

    return {
      id: task.id,
      title: task.title || "",
      description: task.description || "",
      project: project.name || "",
      projectId: task.projectId,
      priority: PRIORITY_TO_UI[task.priority] || "Medium",
      status: STATUS_TO_UI[task.status] || "To Do",
      dueDate: task.dueDate || null,
      assignee: task.assignee || null,
      assigneeId: task.assigneeId || "",
      canManage,
      canChangeStatus: canManage || task.assigneeId === user?.id,
    };
  }

  async function refreshTasks() {
    const result = await apiRequest("/tasks");
    setTasks((result.tasks || []).map(formatTask));
  }

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [projectResult, taskResult] = await Promise.all([
          apiRequest("/projects"),
          apiRequest("/tasks"),
        ]);
        if (!active) return;

        const availableProjects = projectResult.projects || [];
        setProjects(availableProjects);
        setProjectId((current) => current || availableProjects[0]?.id || "");
        setTasks((taskResult.tasks || []).map(formatTask));
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) fetchData();
    return () => {
      active = false;
    };
  }, [token, user?.id]);

  useEffect(() => {
    let active = true;

    async function fetchProjectMembers() {
      if (!projectId || !token || !showForm) {
        setProjectMembers([]);
        return;
      }

      setMembersLoading(true);
      try {
        const result = await apiRequest(`/projects/${projectId}/members`);
        if (active) setProjectMembers(result.members || []);
      } catch (err) {
        if (active) {
          setProjectMembers([]);
          setError(err.message);
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    }

    fetchProjectMembers();
    return () => {
      active = false;
    };
  }, [projectId, showForm, token]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setDueDate("");
    setAssigneeId("");
    setEditingTask(null);
    setShowForm(false);
  }

  function openCreateForm() {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setDueDate("");
    setAssigneeId("");
    setProjectId(projects[0]?.id || "");
    setError("");
    setShowForm(true);
  }

  function handleEditTask(task) {
    if (!task.canManage) return;
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId || "");
    setDueDate(
      task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
    );
    setProjectId(task.projectId || "");
    setShowForm(true);
    setError("");
  }

  async function handleSubmitTask(event) {
    event.preventDefault();
    if (!title.trim() || !projectId) return;

    setSaving(true);
    setError("");

    try {
      if (editingTask) {
        await apiRequest(`/tasks/${editingTask.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            priority: priority.toUpperCase(),
            dueDate: dueDate || null,
            assigneeId: assigneeId || null,
          }),
        });
      } else {
        await apiRequest(`/tasks/projects/${projectId}/tasks`, {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            priority: priority.toUpperCase(),
            dueDate: dueDate || null,
            assigneeId: assigneeId || null,
          }),
        });
      }

      await refreshTasks();
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    const task = tasks.find((item) => item.id === id);
    if (!task || !task.canChangeStatus) return;

    const previousTasks = tasks;
    setTasks((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      )
    );

    try {
      await apiRequest(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: STATUS_TO_API[newStatus] }),
      });
    } catch (err) {
      setTasks(previousTasks);
      setError(err.message);
    }
  }

  async function handleDeleteTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task?.canManage) return;

    const confirmed = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setError("");
    try {
      await apiRequest(`/tasks/${id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== id));
      setSelectedTaskIds((current) => current.filter((taskId) => taskId !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const todoCount = tasks.filter((task) => task.status === "To Do").length;
  const progressCount = tasks.filter((task) => task.status === "In Progress").length;
  const completedCount = tasks.filter((task) => task.status === "Completed").length;
  const overdueCount = tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;

  const canCreateTasks = projects.some((project) =>
    isProjectAdmin(project, user?.id)
  );

  const visibleTasks = useMemo(
    () =>
      taskView === "mine"
        ? tasks.filter((task) => task.assigneeId === user?.id)
        : tasks,
    [tasks, taskView, user?.id]
  );

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return visibleTasks
      .filter((task) => {
        const matchesSearch =
          !query ||
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.project.toLowerCase().includes(query) ||
          (task.assignee?.name || "").toLowerCase().includes(query) ||
          (task.assignee?.email || "").toLowerCase().includes(query);

        return (
          matchesSearch &&
          (projectFilter === "all" || task.projectId === projectFilter) &&
          (statusFilter === "all" || STATUS_TO_API[task.status] === statusFilter) &&
          (priorityFilter === "all" || task.priority === PRIORITY_TO_UI[priorityFilter]) &&
          (assigneeFilter === "all" ||
            (assigneeFilter === "unassigned"
              ? !task.assigneeId
              : task.assigneeId === assigneeFilter))
        );
      })
      .sort((a, b) => {
        if (sortBy === "dueDate") {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (sortBy === "priority") {
          return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        }
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "newest") return 0;
        return 0;
      });
  }, [
    visibleTasks,
    searchTerm,
    projectFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    sortBy,
  ]);

  const selectedTasks = filteredTasks.filter((task) =>
    selectedTaskIds.includes(task.id)
  );
  const manageableSelectedTasks = selectedTasks.filter(
    (task) => task.canChangeStatus
  );

  const assignees = Array.from(
    new Map(
      tasks
        .filter((task) => task.assignee)
        .map((task) => [task.assignee.id, task.assignee])
    ).values()
  );

  function toggleTaskSelection(taskId) {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  }

  function toggleSelectAllFiltered() {
    const ids = filteredTasks.map((task) => task.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedTaskIds.includes(id));

    setSelectedTaskIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    );
  }

  async function handleBulkStatusUpdate() {
    if (manageableSelectedTasks.length === 0) return;

    setBulkSaving(true);
    setError("");
    const failures = [];

    for (const task of manageableSelectedTasks) {
      try {
        await apiRequest(`/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: bulkStatus }),
        });
      } catch (err) {
        failures.push(`${task.title}: ${err.message}`);
      }
    }

    if (failures.length) {
      setError(`Some tasks could not be updated: ${failures.join(" | ")}`);
    }

    try {
      await refreshTasks();
    } catch (err) {
      setError((current) => current || err.message);
    }

    setSelectedTaskIds([]);
    setBulkSaving(false);
  }

  function clearFilters() {
    setSearchTerm("");
    setProjectFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setSortBy("newest");
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] p-8 text-sm text-[var(--fv-text-secondary)]">
        Loading your tasks...
      </div>
    );
  }

  return (
    <main className="min-h-full bg-[var(--fv-bg)] px-5 py-7 text-[var(--fv-text)] sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--fv-text-muted)]">
              <ListTodo size={14} />
              Workspace / Tasks
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              My Tasks
            </h1>
            <p className="mt-2 text-sm text-[var(--fv-text-secondary)]">
              Plan the work, track progress, and keep every detail moving.
            </p>
          </div>

          {canCreateTasks && (
            <button
              type="button"
              onClick={showForm ? resetForm : openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--fv-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--fv-accent)] focus:ring-offset-2 focus:ring-offset-[var(--fv-bg)]"
            >
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "Close form" : "Create task"}
            </button>
          )}
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-lg p-1 transition hover:bg-rose-500/10"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmitTask} className={`${panelClass} mb-7 p-5 sm:p-6`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="rounded-lg bg-[var(--fv-accent-soft)] p-2 text-[var(--fv-accent)]">
                    <Sparkles size={16} />
                  </span>
                  {editingTask ? "Edit task" : "Create a task"}
                </div>
                <p className="mt-2 text-xs text-[var(--fv-text-muted)]">
                  Add the essentials now. You can refine the task as work progresses.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-[var(--fv-text-muted)] transition hover:bg-[var(--fv-bg)] hover:text-[var(--fv-text)]"
                aria-label="Close task form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Task title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Prepare project milestone review"
                  maxLength={150}
                  required
                  className={inputClass}
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add context, acceptance criteria, or useful notes..."
                  rows={3}
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Project
                </span>
                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setAssigneeId("");
                  }}
                  required
                  disabled={projects.length === 0 || Boolean(editingTask)}
                  className={inputClass}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {editingTask && (
                  <span className="mt-1 block text-xs text-[var(--fv-text-muted)]">
                    A task cannot be moved to another project from this form.
                  </span>
                )}
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Priority
                </span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className={inputClass}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Assign to
                </span>
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  disabled={membersLoading || projects.length === 0}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {user && (
                    <option value={user.id}>{user.name} (You)</option>
                  )}
                  {projectMembers
                    .filter((member) => member.user?.id !== user?.id)
                    .map((member) => (
                      <option key={member.id} value={member.user.id}>
                        {member.user.name} ({member.user.email})
                      </option>
                    ))}
                </select>
                {membersLoading && (
                  <span className="mt-1 block text-xs text-[var(--fv-text-muted)]">
                    Loading project members...
                  </span>
                )}
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-[var(--fv-text-secondary)]">
                  Due date
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-[var(--fv-border)] px-5 py-3 text-sm font-medium text-[var(--fv-text-secondary)] transition hover:bg-[var(--fv-bg)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !projects.length || membersLoading}
                className="rounded-xl bg-[var(--fv-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingTask
                    ? "Save changes"
                    : "Create task"}
              </button>
            </div>
          </form>
        )}

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total tasks"
            value={tasks.length}
            detail="Across your accessible projects"
            icon={Target}
          />
          <StatCard
            label="To do"
            value={todoCount}
            detail="Waiting to get started"
            icon={Circle}
          />
          <StatCard
            label="In progress"
            value={progressCount}
            detail="Currently being worked on"
            icon={Clock3}
            tone="warning"
          />
          <StatCard
            label="Completed"
            value={completedCount}
            detail={`${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`}
            icon={CheckCheck}
            tone="success"
          />
        </section>

        <section className={`${panelClass} mb-6 p-4 sm:p-5`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Task workspace</h2>
              <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
                {filteredTasks.length} of {visibleTasks.length} tasks shown
              </p>
            </div>
            <div className="inline-flex w-fit rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-1">
              <button
                type="button"
                onClick={() => setTaskView("all")}
                className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                  taskView === "all"
                    ? "bg-[var(--fv-surface-raised)] text-[var(--fv-text)] shadow-sm"
                    : "text-[var(--fv-text-secondary)] hover:text-[var(--fv-text)]"
                }`}
              >
                All tasks
              </button>
              <button
                type="button"
                onClick={() => setTaskView("mine")}
                className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                  taskView === "mine"
                    ? "bg-[var(--fv-surface-raised)] text-[var(--fv-text)] shadow-sm"
                    : "text-[var(--fv-text-secondary)] hover:text-[var(--fv-text)]"
                }`}
              >
                Assigned to me
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative xl:col-span-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fv-text-muted)]"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tasks, projects, assignees..."
                className={`${inputClass} pl-10`}
              />
            </div>

            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by assignee"
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className={inputClass}
              aria-label="Sort tasks"
            >
              <option value="newest">Sort: Newest</option>
              <option value="dueDate">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
              <option value="title">Sort: Title A–Z</option>
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--fv-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--fv-text-secondary)]">
                <input
                  type="checkbox"
                  checked={
                    filteredTasks.length > 0 &&
                    filteredTasks.every((task) => selectedTaskIds.includes(task.id))
                  }
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 rounded border-[var(--fv-border)] accent-[var(--fv-accent)]"
                />
                Select filtered ({filteredTasks.length})
              </label>
              <span className="text-xs text-[var(--fv-text-muted)]">
                {selectedTasks.length} selected
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-[var(--fv-accent)] transition hover:text-[var(--fv-accent-hover)]"
              >
                Clear filters
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                className={`${inputClass} py-2.5 text-xs sm:w-40`}
                aria-label="Bulk status"
              >
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <button
                type="button"
                onClick={handleBulkStatusUpdate}
                disabled={bulkSaving || manageableSelectedTasks.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--fv-accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck size={15} />
                {bulkSaving
                  ? "Updating..."
                  : `Update ${manageableSelectedTasks.length} selected`}
              </button>
            </div>
          </div>

          {selectedTasks.some((task) => !task.canChangeStatus) && (
            <p className="mt-3 text-xs text-amber-500">
              Tasks you cannot update with your current permissions will be skipped.
            </p>
          )}
        </section>

        <section className={`${panelClass} p-4 sm:p-6`}>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Task board</h2>
              <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
                Move tasks between stages by dragging them across the board.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--fv-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {todoCount} to do
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {progressCount} in progress
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {completedCount} completed
              </span>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--fv-border)] px-6 text-center">
              <span className="mb-3 rounded-2xl bg-[var(--fv-accent-soft)] p-3 text-[var(--fv-accent)]">
                <Filter size={21} />
              </span>
              <h3 className="text-sm font-semibold">No tasks match these filters</h3>
              <p className="mt-1 max-w-sm text-xs text-[var(--fv-text-muted)]">
                Try clearing a filter or changing your search. Your tasks have not been removed.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-[var(--fv-border)] px-3 py-2 text-xs font-medium text-[var(--fv-text-secondary)] transition hover:bg-[var(--fv-bg)]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <KanbanBoard
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              onDeleteTask={handleDeleteTask}
              onEditTask={handleEditTask}
            />
          )}
        </section>
      </div>
    </main>
  );
}

export default Tasks;
