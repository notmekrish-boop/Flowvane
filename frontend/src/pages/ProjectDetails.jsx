
import { useState, useEffect } from "react";
import {
  useParams,
  useNavigate,
  useLocation
} from "react-router-dom";

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
import ProjectTeam from "../components/ProjectTeam";

const API_URL = "http://localhost:5000/api";

const statusLabels = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed"
};


function getActivityChange(details) {
  if (typeof details !== "string") return null;

  const match = details.match(/^(.+?) changed: (.*?) → (.*?)\.?$/);
  if (!match) return null;

  return {
    field: match[1],
    oldValue: match[2],
    newValue: match[3]
  };
}

function displayAuditValue(value) {
  const labels = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    "null": "Unassigned",
    "No due date": "No due date"
  };

  return labels[value] || value;
}

const priorityColors = {
  HIGH: "bg-red-100 text-red-600",
  MEDIUM: "bg-orange-100 text-orange-600",
  LOW: "bg-green-100 text-green-600"
};

function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { token, user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showEditForm, setShowEditForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [isProjectAdmin, setIsProjectAdmin] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskEditError, setTaskEditError] = useState("");
  const [taskEditForm, setTaskEditForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: "",
    assigneeId: ""
  });

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

  // FETCH PROJECT DETAILS
  useEffect(() => {
    async function fetchProjectDetails() {
      setLoading(true);
      setError("");

      try {
        const [projectResult, taskResult] = await Promise.all([
          apiRequest(`/projects/${id}`),
          apiRequest(`/tasks/projects/${id}/tasks`)
        ]);

        setProject(projectResult.project);
        setTasks(taskResult.tasks || []);
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

  // FETCH PROJECT TEAM MEMBERS FOR TASK ASSIGNMENT
  useEffect(() => {
    async function fetchTeamMembers() {
      try {
        const result = await apiRequest(`/projects/${id}/members`);
        setTeamMembers(result.members || []);
      } catch (err) {
        console.error("Unable to fetch project team members:", err);
      }
    }

    if (token && id) {
      fetchTeamMembers();
    }
  }, [token, id]);

  // OPEN TASK FROM NOTIFICATION
  useEffect(() => {
    const openTaskId = location.state?.openTaskId;

    if (!openTaskId || tasks.length === 0) return;

    const taskExists = tasks.some(
      (task) => task.id === openTaskId
    );

    if (taskExists) {
      setSelectedTaskId(openTaskId);

      const taskElement = document.querySelector(
        `[data-task-id="${openTaskId}"]`
      );

      if (taskElement) {
        taskElement.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

      navigate(location.pathname, {
        replace: true,
        state: null
      });
    }
  }, [tasks, location.state, location.pathname, navigate]);

  // CHECK PROJECT OWNER
  const isProjectOwner =
    Boolean(project?.ownerId) &&
    Boolean(user?.id) &&
    project.ownerId === user.id;

  // OWNER OR ADMIN CAN MANAGE PROJECT
  const canManageProject = isProjectOwner || isProjectAdmin;

  // OPEN EDIT FORM
  function handleEditClick() {
    if (!canManageProject) return;

    setName(project.name);
    setDescription(project.description || "");
    setShowEditForm(true);
    setError("");
  }

  // CANCEL EDITING
  function handleCancelEdit() {
    setShowEditForm(false);
    setName("");
    setDescription("");
    setError("");
  }

  // OPEN TASK EDIT FORM (OWNERS AND ADMINS ONLY)
  function handleStartTaskEdit() {
    if (!canManageProject || !selectedTask) return;

    let dueDateValue = "";
    if (selectedTask.dueDate) {
      const date = new Date(selectedTask.dueDate);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      dueDateValue = date.toISOString().slice(0, 10);
    }

    setTaskEditForm({
      title: selectedTask.title || "",
      description: selectedTask.description || "",
      priority: selectedTask.priority || "MEDIUM",
      status: selectedTask.status || "TODO",
      dueDate: dueDateValue,
      assigneeId: selectedTask.assigneeId || selectedTask.assignee?.id || ""
    });
    setTaskEditError("");
    setEditingTask(true);
  }

  // SAVE TASK CHANGES
  async function handleUpdateTask(e) {
    e.preventDefault();

    if (!canManageProject || !selectedTask) return;

    if (!taskEditForm.title.trim()) {
      setTaskEditError("Task title is required.");
      return;
    }

    setTaskSaving(true);
    setTaskEditError("");

    try {
      const result = await apiRequest(`/tasks/${selectedTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: taskEditForm.title.trim(),
          description: taskEditForm.description.trim() || null,
          priority: taskEditForm.priority,
          status: taskEditForm.status,
          dueDate: taskEditForm.dueDate
            ? new Date(`${taskEditForm.dueDate}T00:00:00`).toISOString()
            : null,
          assigneeId: taskEditForm.assigneeId || null
        })
      });

      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          task.id === result.task.id ? result.task : task
        )
      );
      setSelectedTask(result.task);
      setEditingTask(false);
      window.dispatchEvent(new Event("tasksUpdated"));
    } catch (err) {
      setTaskEditError(err.message);
    } finally {
      setTaskSaving(false);
    }
  }

  // LOAD COMMENTS AND ACTIVITY WHEN A TASK IS OPENED
  useEffect(() => {
    async function fetchTaskDiscussion() {
      if (!selectedTask?.id || !token) return;

      setDiscussionLoading(true);
      setCommentError("");

      try {
        const [commentsResult, activitiesResult] = await Promise.all([
          apiRequest(`/tasks/${selectedTask.id}/comments`),
          apiRequest(`/tasks/${selectedTask.id}/activities`)
        ]);

        setComments(commentsResult.comments || []);
        setActivities(activitiesResult.activities || []);
      } catch (err) {
        setCommentError(err.message || "Unable to load task discussion.");
      } finally {
        setDiscussionLoading(false);
      }
    }

    fetchTaskDiscussion();
  }, [selectedTask?.id, token]);

  // ADD A COMMENT
  async function handleAddComment(e) {
    e.preventDefault();

    if (!selectedTask?.id || !commentText.trim()) return;

    setCommentSaving(true);
    setCommentError("");

    try {
      const result = await apiRequest(`/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText.trim() })
      });

      setComments((current) => [...current, result.comment]);
      setCommentText("");

      const activityResult = await apiRequest(
        `/tasks/${selectedTask.id}/activities`
      );
      setActivities(activityResult.activities || []);
    } catch (err) {
      setCommentError(err.message || "Unable to add comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  // SAVE PROJECT CHANGES
  async function handleUpdateProject(e) {
    e.preventDefault();

    if (!canManageProject) {
      setError("You do not have permission to edit this project.");
      return;
    }

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

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6"
      >
        <ArrowLeft size={18} />
        Back to Projects
      </button>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {/* PROJECT HEADER */}
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

          {canManageProject && (
            <button
              onClick={handleEditClick}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shrink-0"
            >
              <Pencil size={16} />
              Edit Project
            </button>
          )}
        </div>
      </div>

      {/* EDIT PROJECT FORM */}
      {canManageProject && showEditForm && (
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

      {/* PROJECT STATISTICS */}
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

      {/* PROJECT PROGRESS */}
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

      {/* PROJECT TEAM */}
      <ProjectTeam
        projectId={id}
        canManage={isProjectOwner}
        onAdminLoaded={setIsProjectAdmin}
      />

      {/* PROJECT TASKS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-8">

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
  data-task-id={task.id}
  onClick={() => setSelectedTask(task)}
  className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
    selectedTaskId === task.id
      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
      : "border-slate-200"
  }`}
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

                  <span className="text-slate-500">
                    Assigned to: {task.assignee?.name || "Unassigned"}
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
      {/* TASK DETAILS MODAL */}
{selectedTask && (
  <div
    className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
    onClick={() => { setSelectedTask(null); setEditingTask(false); setTaskEditError(""); }}
  >
    <div
      className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Task Details
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {project.name}
          </p>
        </div>

        <button
          onClick={() => { setSelectedTask(null); setEditingTask(false); setTaskEditError(""); }}
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={22} />
        </button>
      </div>

      {editingTask ? (
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Task Title
            </label>
            <input
              type="text"
              value={taskEditForm.title}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, title: e.target.value })}
              maxLength={150}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={taskEditForm.description}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, description: e.target.value })}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={taskEditForm.priority}
                onChange={(e) => setTaskEditForm({ ...taskEditForm, priority: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                value={taskEditForm.status}
                onChange={(e) => setTaskEditForm({ ...taskEditForm, status: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={taskEditForm.dueDate}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, dueDate: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign To
            </label>
            <select
              value={taskEditForm.assigneeId}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, assigneeId: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
            >
              <option value="">Unassigned</option>
              {selectedTask.assignee &&
                !teamMembers.some((member) => member.userId === selectedTask.assignee.id) && (
                  <option value={selectedTask.assignee.id}>
                    {selectedTask.assignee.name} (current assignee)
                  </option>
                )}
              {teamMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.name || member.user?.email || "Team member"} ({member.role})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Only project owners and admins can change task assignments.
            </p>
          </div>

          {taskEditError && (
            <p className="text-sm text-red-600">{taskEditError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={taskSaving}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {taskSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTask(false);
                setTaskEditError("");
              }}
              disabled={taskSaving}
              className="flex-1 border border-slate-200 py-3 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {selectedTask.title}
          </h3>

          <p className="text-sm text-slate-500 mb-6">
            {selectedTask.description || "No description provided."}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-2">Priority</p>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${priorityColors[selectedTask.priority]}`}>
                {selectedTask.priority}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-2">Status</p>
              <span className="text-sm font-medium text-slate-700">
                {statusLabels[selectedTask.status]}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 col-span-2">
              <p className="text-xs text-slate-400 mb-2">Assigned To</p>
              <p className="text-sm text-slate-700">
                {selectedTask.assignee?.name || "Unassigned"}
              </p>
              {selectedTask.assignee?.email && (
                <p className="text-xs text-slate-500 mt-1">
                  {selectedTask.assignee.email}
                </p>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 col-span-2">
              <p className="text-xs text-slate-400 mb-2">Due Date</p>
              <p className="text-sm text-slate-700">
                {selectedTask.dueDate
                  ? new Date(selectedTask.dueDate).toLocaleDateString("en-IN")
                  : "No due date"}
              </p>
            </div>
          </div>

          {canManageProject && (
            <button
              onClick={handleStartTaskEdit}
              className="w-full mt-6 border border-blue-600 text-blue-600 py-3 rounded-xl hover:bg-blue-50"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Pencil size={16} />
                Edit Task
              </span>
            </button>
          )}
        </>
      )}

      {!editingTask && (
        <div className="mt-8 border-t border-slate-200 pt-6 space-y-7">
          {/* COMMENTS */}
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Comments ({comments.length})
            </h3>

            <form onSubmit={handleAddComment} className="space-y-3 mb-5">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                maxLength={2000}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 resize-y"
              />
              <div className="flex justify-between items-center gap-3">
                <p className="text-xs text-slate-400">
                  Maximum 2000 characters
                </p>
                <button
                  type="submit"
                  disabled={commentSaving || !commentText.trim()}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {commentSaving ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </form>

            {commentError && (
              <p className="text-sm text-red-600 mb-3">{commentError}</p>
            )}

            {discussionLoading ? (
              <p className="text-sm text-slate-500">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <span className="font-semibold text-sm text-slate-800">
                        {comment.user?.name || "Former user"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ACTIVITY HISTORY */}
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Activity History
            </h3>

            {discussionLoading ? (
              <p className="text-sm text-slate-500">Loading activity...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {activity.user?.name || "A former user"}
                      </p>
                      {(() => {
                        const change = getActivityChange(activity.details);

                        if (!change) {
                          return (
                            <p className="text-sm text-slate-600">
                              {activity.details || activity.type.replaceAll("_", " ").toLowerCase()}
                            </p>
                          );
                        }

                        return (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-slate-600">
                              {change.field}:
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600 line-through">
                              {displayAuditValue(change.oldValue)}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="rounded-md bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                              {displayAuditValue(change.newValue)}
                            </span>
                          </div>
                        );
                      })()}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(activity.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <button
        onClick={() => {
          setSelectedTask(null);
          setEditingTask(false);
          setTaskEditError("");
          setCommentText("");
          setCommentError("");
        }}
        className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700"
      >
        Close
      </button>
    </div>
  </div>
)}

    </div>
  );
}

export default ProjectDetails;
