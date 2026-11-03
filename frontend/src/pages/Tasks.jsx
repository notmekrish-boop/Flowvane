
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
        ...options.headers
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Something went wrong.");
    }

    return result;
  }

  // Format task and determine the current user's permissions
  function formatTask(task) {
    const project = task.project || {};

    const isOwner = project.ownerId === user?.id;

    const isAdmin = project.members?.some(
      (member) => member.role === "ADMIN"
    ) || false;

    const canManage = isOwner || isAdmin;

    return {
      id: task.id,
      title: task.title,
      description: task.description || "",
      project: project.name || "",
      projectId: task.projectId,
      priority: priorityToUI[task.priority],
      status: statusToUI[task.status],
      dueDate: task.dueDate,
      assignee: task.assignee || null,
      assigneeId: task.assigneeId || "",
      canManage,
      canChangeStatus: canManage || task.assigneeId === user?.id
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

  // Fetch project members
  useEffect(() => {
    async function fetchProjectMembers() {
      if (!projectId || !token || !showForm) {
        setProjectMembers([]);
        return;
      }

      setMembersLoading(true);

      try {
        const result = await apiRequest(
          `/projects/${projectId}/members`
        );

        setProjectMembers(result.members || []);
      } catch (err) {
        setProjectMembers([]);
        setError(err.message);
      } finally {
        setMembersLoading(false);
      }
    }

    fetchProjectMembers();
  }, [projectId, showForm, token]);

  // Reset form
  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setDueDate("");
    setAssigneeId("");
    setEditingTask(null);
    setShowForm(false);
  }

  // Open edit form
  function handleEditTask(task) {
    if (!task.canManage) return;

    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId || "");

    setDueDate(
      task.dueDate
        ? new Date(task.dueDate).toISOString().slice(0, 10)
        : ""
    );

    setProjectId(task.projectId || "");
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
            dueDate: dueDate || null,
            assigneeId: assigneeId || null
          })
        });

        setTasks((previousTasks) =>
          previousTasks.map((task) =>
            task.id === editingTask.id
              ? {
                  ...formatTask({
                    ...result.task,
                    project: {
                      id: task.projectId,
                      name: task.project,
                      ownerId: task.canManage ? user?.id : undefined
                    },
                    projectId: task.projectId
                  }),
                  canManage: task.canManage,
                  canChangeStatus: task.canChangeStatus
                }
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
              dueDate: dueDate || null,
              assigneeId: assigneeId || null
            })
          }
        );

        const selectedProject = projects.find(
          (project) => project.id === projectId
        );

        const newTask = formatTask({
          ...result.task,
          project: {
            id: projectId,
            name: selectedProject.name,
            ownerId: user?.id
          },
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
    const task = tasks.find((item) => item.id === id);

    if (!task || !task.canChangeStatus) return;

    const previousTasks = tasks;

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
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
    const task = tasks.find((item) => item.id === id);

    if (!task?.canManage) return;

    setError("");

    try {
      await apiRequest(`/tasks/${id}`, {
        method: "DELETE"
      });

      setTasks((previousTasks) =>
        previousTasks.filter((item) => item.id !== id)
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

  const visibleTasks =
    taskView === "mine"
      ? tasks.filter((task) => task.assigneeId === user?.id)
      : tasks;

  const filteredTasks = visibleTasks
    .filter((task) => {
      const query = searchTerm.trim().toLowerCase();
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
        (statusFilter === "all" || statusToAPI[task.status] === statusFilter) &&
        (priorityFilter === "all" || task.priority === priorityToUI[priorityFilter]) &&
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
        const rank = { High: 3, Medium: 2, Low: 1 };
        return rank[b.priority] - rank[a.priority];
      }

      if (sortBy === "title") return a.title.localeCompare(b.title);

      return 0; // API returns newest tasks first.
    });

  const selectedTasks = filteredTasks.filter((task) =>
    selectedTaskIds.includes(task.id)
  );
  const manageableSelectedTasks = selectedTasks.filter(
    (task) => task.canChangeStatus
  );

  const canCreateTasks = projects.some(
    (project) =>
      project.ownerId === user?.id ||
      project.members?.some((member) => member.role === "ADMIN")
  );

  function toggleTaskSelection(taskId) {
    setSelectedTaskIds((previous) =>
      previous.includes(taskId)
        ? previous.filter((id) => id !== taskId)
        : [...previous, taskId]
    );
  }

  function toggleSelectAllFiltered() {
    const ids = filteredTasks.map((task) => task.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTaskIds.includes(id));

    setSelectedTaskIds((previous) =>
      allSelected
        ? previous.filter((id) => !ids.includes(id))
        : [...new Set([...previous, ...ids])]
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
          body: JSON.stringify({ status: bulkStatus })
        });
      } catch (err) {
        failures.push(`${task.title}: ${err.message}`);
      }
    }

    if (failures.length > 0) {
      setError(`Some tasks could not be updated: ${failures.join(" | ")}`);
    }

    try {
      const result = await apiRequest("/tasks");
      setTasks(result.tasks.map(formatTask));
    } catch (err) {
      setError((previous) => previous || err.message);
    }

    setSelectedTaskIds([]);
    setBulkSaving(false);
  }

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

        {canCreateTasks && (
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
                setAssigneeId("");
                setShowForm(true);
                setError("");
              }
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? "Close Form" : "Create Task"}
          </button>
        )}
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
              <label className="block text-sm mb-2">
                Task Title
              </label>

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
              <label className="block text-sm mb-2">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your task..."
                rows="3"
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">
                Project
              </label>

              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setAssigneeId("");
                }}
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

            <div>
              <label className="block text-sm mb-2">
                Assign To
              </label>

              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={membersLoading || projects.length === 0}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                <option value="">Unassigned</option>

                {user && (
                  <option value={user.id}>
                    {user.name} (Project Owner)
                  </option>
                )}

                {projectMembers.map((member) => (
                  <option key={member.id} value={member.user.id}>
                    {member.user.name} ({member.user.email})
                  </option>
                ))}
              </select>

              {membersLoading && (
                <p className="text-xs text-slate-500 mt-1">
                  Loading project members...
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-2">
                Due Date
              </label>

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
                disabled={saving || projects.length === 0 || membersLoading}
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

      {/* Task Filters */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setTaskView("all")}
          className={`px-5 py-2 rounded-xl font-medium ${
            taskView === "all"
              ? "bg-blue-600 text-white"
              : "bg-white border text-slate-600"
          }`}
        >
          All Tasks
        </button>

        <button
          onClick={() => setTaskView("mine")}
          className={`px-5 py-2 rounded-xl font-medium ${
            taskView === "mine"
              ? "bg-blue-600 text-white"
              : "bg-white border text-slate-600"
          }`}
        >
          Assigned to Me
        </button>
      </div>

      {/* SEARCH, FILTERS AND BULK ACTIONS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search title, description, project or assignee..."
            className="md:col-span-2 xl:col-span-1 w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
          >
            <option value="all">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {Array.from(
              new Map(
                tasks
                  .filter((task) => task.assignee)
                  .map((task) => [task.assignee.id, task.assignee])
              ).values()
            ).map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
          >
            <option value="newest">Sort: Newest</option>
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Title A–Z</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))}
                onChange={toggleSelectAllFiltered}
                className="h-4 w-4 rounded border-slate-300"
              />
              Select filtered ({filteredTasks.length})
            </label>
            <span className="text-xs text-slate-400">
              {selectedTasks.length} selected
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <button
              type="button"
              onClick={handleBulkStatusUpdate}
              disabled={bulkSaving || manageableSelectedTasks.length === 0}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {bulkSaving ? "Updating..." : `Update ${manageableSelectedTasks.length} selected`}
            </button>
          </div>
        </div>

        {selectedTasks.some((task) => !task.canChangeStatus) && (
          <p className="text-xs text-amber-600">
            Some selected tasks cannot be updated with your current permissions and will be skipped.
          </p>
        )}
      </section>

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
          tasks={filteredTasks}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
          onEditTask={handleEditTask}
        />
      </div>
    </div>
  );
}

export default Tasks;
