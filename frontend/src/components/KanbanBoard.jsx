
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../lib/api.js";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  Trash2,
  Pencil,
  Circle,
  Clock,
  CheckCircle2,
  CalendarDays,
  User,
  X,
  ClipboardList,
  MessageSquare,
  Send,
  Activity,
  ListTodo,
  GitBranch,
  Link2,
  Tags,
  StickyNote,
  Bell,
  Paperclip,
  Download
} from "./icons";


function formatMinutes(minutes) {
  if (minutes == null) return "Not set";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

async function requestTaskDetails(token, endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Unable to load task details.");
  return result;
}

const columns = [
  { id: "To Do", title: "To Do" },
  { id: "In Progress", title: "In Progress" },
  { id: "Completed", title: "Completed" }
];

const priorityColors = {
  High: "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low: "bg-green-100 text-green-600"
};

const statusIcons = {
  "To Do": Circle,
  "In Progress": Clock,
  "Completed": CheckCircle2
};

function getInitials(name) {
  if (!name) return "?";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// Task details modal
function TaskDetailsModal({
  task,
  onClose,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onTasksChanged
}) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [taskDetails, setTaskDetails] = useState({
    taskId: null,
    loading: true,
    error: "",
    comments: [],
    activities: [],
    subtasks: [],
    attachments: [],
    dependencies: [],
    availableTasks: []
  });
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDescription, setSubtaskDescription] = useState("");
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [subtaskError, setSubtaskError] = useState("");
  const [selectedDependencyId, setSelectedDependencyId] = useState("");
  const [dependencySaving, setDependencySaving] = useState(false);
  const [dependencyError, setDependencyError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const closeButtonRef = useRef(null);
  const detailsLoading = taskDetails.taskId !== task?.id || taskDetails.loading;
  const detailsError = taskDetails.taskId === task?.id ? taskDetails.error : "";
  const comments = taskDetails.taskId === task?.id ? taskDetails.comments : [];
  const activities = taskDetails.taskId === task?.id ? taskDetails.activities : [];
  const subtasks = taskDetails.taskId === task?.id ? taskDetails.subtasks : [];
  const attachments = taskDetails.taskId === task?.id ? taskDetails.attachments : [];
  const dependencies = taskDetails.taskId === task?.id ? taskDetails.dependencies : [];
  const availableTasks = taskDetails.taskId === task?.id ? taskDetails.availableTasks : [];
  const unfinishedDependencies = dependencies.filter((dependency) => dependency.dependsOnTask?.status !== "COMPLETED");

  useEffect(() => {
    if (!task?.id || !token) return undefined;
    let active = true;
    Promise.all([
      requestTaskDetails(token, `/tasks/${task.id}/comments`),
      requestTaskDetails(token, `/tasks/${task.id}/activities`),
      requestTaskDetails(token, `/tasks/${task.id}/subtasks`),
      requestTaskDetails(token, `/tasks/${task.id}/dependencies`),
      requestTaskDetails(token, `/tasks/${task.id}/attachments`)
    ])
      .then(([commentResult, activityResult, subtaskResult, dependencyResult, attachmentResult]) => {
        if (!active) return;
        setTaskDetails({
          taskId: task.id,
          loading: false,
          error: "",
          comments: commentResult.comments || [],
          activities: activityResult.activities || [],
          subtasks: subtaskResult.subtasks || [],
          attachments: attachmentResult.attachments || [],
          dependencies: dependencyResult.dependencies || [],
          availableTasks: dependencyResult.availableTasks || []
        });
      })
      .catch((error) => {
        if (active) setTaskDetails({ taskId: task.id, loading: false, error: error.message, comments: [], activities: [], subtasks: [], attachments: [], dependencies: [], availableTasks: [] });
      });
    return () => { active = false; };
  }, [task?.id, token]);

  async function uploadAttachment(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setAttachmentError("Choose a file up to 3 MB.");
      return;
    }

    setAttachmentSaving(true);
    setAttachmentError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read this file."));
        reader.readAsDataURL(file);
      });
      const result = await requestTaskDetails(token, `/tasks/${task.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileData: String(dataUrl).split(",")[1] })
      });
      setTaskDetails((current) => current.taskId === task.id ? { ...current, attachments: [result.attachment, ...current.attachments] } : current);
    } catch (error) {
      setAttachmentError(error.message);
    } finally {
      setAttachmentSaving(false);
    }
  }

  async function downloadAttachment(attachment) {
    setAttachmentError("");
    try {
      const response = await fetch(`${API_URL}/tasks/${task.id}/attachments/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Unable to download attachment.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setAttachmentError(error.message);
    }
  }

  async function deleteAttachment(attachment) {
    if (!window.confirm(`Delete “${attachment.fileName}”?`)) return;
    setAttachmentError("");
    try {
      await requestTaskDetails(token, `/tasks/${task.id}/attachments/${attachment.id}`, { method: "DELETE" });
      setTaskDetails((current) => current.taskId === task.id ? { ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id) } : current);
    } catch (error) {
      setAttachmentError(error.message);
    }
  }

  function formatFileSize(size) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!task) return null;

  const assignee = task.assignee;
  const StatusIcon = statusIcons[task.status];

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "No due date";

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "Completed";

  function handleDelete() {
    onDeleteTask(task.id);
    onClose();
  }

  async function handleSubmitComment(event) {
    event.preventDefault();
    const content = commentText.trim();
    if (!content || commentSaving) return;
    setCommentSaving(true);
    setCommentError("");
    try {
      const result = await requestTaskDetails(token, `/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content })
      });
      setTaskDetails((current) => current.taskId === task.id
        ? { ...current, comments: [...current.comments, result.comment] }
        : current);
      setCommentText("");
      requestTaskDetails(token, `/tasks/${task.id}/activities`)
        .then((activityResult) => setTaskDetails((current) => current.taskId === task.id
          ? { ...current, activities: activityResult.activities || [] }
          : current))
        .catch(() => {});
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleCreateSubtask(event) {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title || subtaskSaving) return;
    setSubtaskSaving(true);
    setSubtaskError("");
    try {
      const result = await requestTaskDetails(token, `/tasks/${task.id}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title, description: subtaskDescription.trim() || undefined })
      });
      setTaskDetails((current) => current.taskId === task.id
        ? { ...current, subtasks: [...current.subtasks, result.subtask] }
        : current);
      setSubtaskTitle("");
      setSubtaskDescription("");
      onTasksChanged?.();
    } catch (error) {
      setSubtaskError(error.message);
    } finally {
      setSubtaskSaving(false);
    }
  }

  async function handleSubtaskStatusChange(subtask, status) {
    const previousStatus = subtask.status;
    setTaskDetails((current) => current.taskId === task.id
      ? { ...current, subtasks: current.subtasks.map((item) => item.id === subtask.id ? { ...item, status } : item) }
      : current);
    setSubtaskError("");
    try {
      await requestTaskDetails(token, `/tasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      onTasksChanged?.();
    } catch (error) {
      setTaskDetails((current) => current.taskId === task.id
        ? { ...current, subtasks: current.subtasks.map((item) => item.id === subtask.id ? { ...item, status: previousStatus } : item) }
        : current);
      setSubtaskError(error.message);
    }
  }

  async function handleAddDependency(event) {
    event.preventDefault();
    if (!selectedDependencyId || dependencySaving) return;
    setDependencySaving(true);
    setDependencyError("");
    try {
      const result = await requestTaskDetails(token, `/tasks/${task.id}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ dependsOnTaskId: selectedDependencyId })
      });
      setTaskDetails((current) => current.taskId === task.id
        ? { ...current, dependencies: [...current.dependencies, result.dependency] }
        : current);
      setSelectedDependencyId("");
    } catch (error) {
      setDependencyError(error.message);
    } finally {
      setDependencySaving(false);
    }
  }

  async function handleRemoveDependency(dependency) {
    setDependencyError("");
    try {
      await requestTaskDetails(token, `/tasks/${task.id}/dependencies/${dependency.dependsOnTaskId}`, { method: "DELETE" });
      setTaskDetails((current) => current.taskId === task.id
        ? { ...current, dependencies: current.dependencies.filter((item) => item.id !== dependency.id) }
        : current);
    } catch (error) {
      setDependencyError(error.message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
    >
      <button
        type="button"
        aria-label="Close task details"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-[var(--fv-border)] bg-[var(--fv-surface)] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--fv-border)] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7068FF]/10 text-[#6258E8] flex items-center justify-center">
              <ClipboardList size={21} />
            </div>

            <div>
              <h2 id="task-details-title" className="text-lg font-semibold text-[var(--fv-text)]">
                Task Details
              </h2>

              <p className="text-xs text-[var(--fv-text-muted)]">
                {task.project}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            className="rounded-lg p-2 text-[var(--fv-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--fv-text)] focus-visible:outline-2 focus-visible:outline-[#7068FF]"
            aria-label="Close task details"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 md:p-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
              Task Title
            </p>

            <h3 className="text-xl font-semibold text-[var(--fv-text)]">
              {task.title}
            </h3>
            {task.labels?.length > 0 && <ul aria-label="Task labels" className="mt-3 flex flex-wrap gap-2">{task.labels.map((label) => <li key={label} className="rounded-full border border-[var(--fv-border)] bg-[var(--fv-surface-raised)] px-2.5 py-1 text-xs text-[var(--fv-text-secondary)]">{label}</li>)}</ul>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
              Description
            </p>

            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--fv-text-secondary)]">
              {task.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4 sm:col-span-2">
              <p className="mb-2 text-xs text-[var(--fv-text-muted)]">Time tracking</p>
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--fv-text)]"><Clock size={15} aria-hidden="true" /> Estimated {formatMinutes(task.estimatedMinutes)} <span className="text-[var(--fv-text-muted)]">·</span> Logged {formatMinutes(task.actualMinutes ?? 0)}</p>
            </div>
            {Object.entries(task.customFields || {}).length > 0 && (
              <div className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4 sm:col-span-2">
                <p className="mb-3 text-xs text-[var(--fv-text-muted)]">Custom fields</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {Object.entries(task.customFields).map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-xs text-[var(--fv-text-muted)]">{key}</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-[var(--fv-text)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4">
              <p className="mb-2 text-xs text-[var(--fv-text-muted)]">
                Project
              </p>

              <p className="text-sm font-medium text-[var(--fv-text)]">
                {task.project}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4">
              <p className="mb-2 text-xs text-[var(--fv-text-muted)]">
                Priority
              </p>

              <span
                className={`inline-block text-xs px-3 py-1 rounded-full ${
                  priorityColors[task.priority] ||
                  "bg-[var(--fv-surface-raised)] text-[var(--fv-text-secondary)]"
                }`}
              >
                {task.priority}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4">
              <p className="mb-2 text-xs text-[var(--fv-text-muted)]">Reminder</p>
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--fv-text)]"><Bell size={15} aria-hidden="true" />{task.reminderAt ? new Date(task.reminderAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "No reminder set"}</p>
            </div>
          </div>

          <section aria-label="Task notes" className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-[var(--fv-text)]">Notes for this task</h3>
                <p className="mt-1 text-xs text-[var(--fv-text-muted)]">Link a private note to keep task context close.</p>
              </div>
              <button type="button" onClick={() => navigate(`/notes?taskId=${encodeURIComponent(task.id)}`)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--fv-border)] px-3 text-xs font-medium text-[var(--fv-text-secondary)] transition hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[#7068FF]">
                <StickyNote size={14} aria-hidden="true" /> Open task notes
              </button>
            </div>
          </section>

          <section aria-label="Task attachments" className="rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--fv-text)]"><Paperclip size={15} aria-hidden="true" /> Attachments <span className="text-xs tabular-nums text-[var(--fv-text-muted)]">{attachments.length}</span></h3>
                <p className="mt-1 text-xs text-[var(--fv-text-muted)]">Files are limited to 3 MB each.</p>
              </div>
              {(task.canManage || task.assigneeId === user?.id) && (
                <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--fv-border)] px-3 text-xs font-medium text-[var(--fv-text-secondary)] transition hover:bg-white/[0.04] focus-within:outline-2 focus-within:outline-[#7068FF] ${attachmentSaving ? "pointer-events-none opacity-50" : ""}`}>
                  <Paperclip size={14} aria-hidden="true" /> {attachmentSaving ? "Uploading…" : "Attach file"}
                  <input type="file" className="sr-only" onChange={uploadAttachment} disabled={attachmentSaving} />
                </label>
              )}
            </div>
            {attachmentError && <p role="alert" className="mt-3 text-xs text-rose-500">{attachmentError}</p>}
            {attachments.length ? (
              <ul className="mt-3 divide-y divide-[var(--fv-border)]">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Paperclip size={15} className="shrink-0 text-[var(--fv-text-muted)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--fv-text)]">{attachment.fileName}</p>
                      <p className="mt-0.5 text-xs text-[var(--fv-text-muted)]">{formatFileSize(attachment.size)} · {attachment.uploader?.name || "Team member"}</p>
                    </div>
                    <button type="button" onClick={() => downloadAttachment(attachment)} aria-label={`Download ${attachment.fileName}`} title="Download" className="rounded-lg p-2 text-[var(--fv-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--fv-text)] focus-visible:outline-2 focus-visible:outline-[#7068FF]"><Download size={15} aria-hidden="true" /></button>
                    {(task.canManage || attachment.uploader?.id === user?.id) && <button type="button" onClick={() => deleteAttachment(attachment)} aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" className="rounded-lg p-2 text-[var(--fv-text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 focus-visible:outline-2 focus-visible:outline-rose-500"><Trash2 size={15} aria-hidden="true" /></button>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-xs text-[var(--fv-text-muted)]">No files attached to this task.</p>}
          </section>

          {/* Assignee */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
              Assigned To
            </p>

            <div className="flex items-center gap-3 rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-3">
              {assignee ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-[#7068FF]/10 text-[#6258E8] flex items-center justify-center text-sm font-bold">
                    {getInitials(assignee.name)}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--fv-text)]">
                      {assignee.name}
                    </p>

                    <p className="text-xs text-[var(--fv-text-muted)]">
                      {assignee.email || ""}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fv-surface-raised)] text-[var(--fv-text-muted)]">
                    <User size={18} aria-hidden="true" />
                  </div>

                  <p className="text-sm text-[var(--fv-text-secondary)]">
                    Unassigned
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
              Due Date
            </p>

            <div
              className={`flex items-center gap-2 text-sm ${
                isOverdue ? "text-rose-400" : "text-[var(--fv-text-secondary)]"
              }`}
            >
              <CalendarDays size={17} aria-hidden="true" />
              {formattedDate}

              {isOverdue && (
                <span className="font-semibold">(Overdue)</span>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
              Task Status
            </p>

            {task.canChangeStatus ? (
              <select
                value={task.status}
                onChange={(e) =>
                  onStatusChange(task.id, e.target.value)
                }
                className="w-full rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] px-4 py-3 text-sm text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id} disabled={column.id === "Completed" && unfinishedDependencies.length > 0}>
                    {column.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-3 text-sm text-[var(--fv-text)]">
                {StatusIcon && <StatusIcon size={18} aria-hidden="true" />}
                {task.status}
              </div>
            )}

            {task.canChangeStatus && !task.canManage && (
              <p className="mt-2 text-xs text-[var(--fv-text-muted)]">
                You can update the status of tasks assigned to you.
              </p>
            )}
          </div>

          <section aria-labelledby="task-subtasks-title" className="border-t border-[var(--fv-border)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 id="task-subtasks-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--fv-text)]">
                <ListTodo size={16} aria-hidden="true" /> Subtasks
              </h3>
              <span className="text-xs tabular-nums text-[var(--fv-text-muted)]">{subtasks.length}</span>
            </div>
            {detailsLoading ? (
              <p className="py-4 text-sm text-[var(--fv-text-muted)]" role="status">Loading subtasks…</p>
            ) : subtasks.length ? (
              <ul className="mt-3 divide-y divide-[var(--fv-border)]">
                {subtasks.map((subtask) => {
                  const mayChangeStatus = task.canManage || subtask.assigneeId === user?.id;
                  const statusLabels = { TODO: "To Do", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
                  return (
                    <li key={subtask.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-[var(--fv-text)]">{subtask.title}</p>
                        <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
                          {subtask.assignee?.name || "Unassigned"}{subtask.dueDate ? ` · Due ${new Date(subtask.dueDate).toLocaleDateString("en-IN")}` : ""}
                        </p>
                      </div>
                      {mayChangeStatus ? (
                        <select
                          aria-label={`Status for ${subtask.title}`}
                          value={subtask.status}
                          onChange={(event) => handleSubtaskStatusChange(subtask, event.target.value)}
                          className="rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-2.5 py-2 text-xs text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
                        >
                          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      ) : (
                        <span className="rounded-full bg-[var(--fv-surface-raised)] px-2.5 py-1 text-xs text-[var(--fv-text-secondary)]">{statusLabels[subtask.status] || subtask.status}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-4 text-sm text-[var(--fv-text-muted)]">No subtasks yet.</p>
            )}
            {subtaskError && <p className="mt-2 text-sm text-rose-400" role="alert">{subtaskError}</p>}
            {task.canManage && !task.parentTaskId && (
              <form onSubmit={handleCreateSubtask} className="mt-3 space-y-2 border-t border-[var(--fv-border)] pt-3">
                <label htmlFor="subtask-title" className="sr-only">Subtask title</label>
                <input
                  id="subtask-title"
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  maxLength={150}
                  placeholder="Add a subtask"
                  className="w-full rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-3 py-2.5 text-sm text-[var(--fv-text)] outline-none placeholder:text-[var(--fv-text-muted)] focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
                />
                <label htmlFor="subtask-description" className="sr-only">Subtask description</label>
                <textarea
                  id="subtask-description"
                  value={subtaskDescription}
                  onChange={(event) => setSubtaskDescription(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Description (optional)"
                  className="w-full resize-y rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] p-3 text-sm text-[var(--fv-text)] outline-none placeholder:text-[var(--fv-text-muted)] focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={!subtaskTitle.trim() || subtaskSaving || detailsLoading} className="min-h-9 rounded-lg bg-[var(--fv-accent)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-40">
                    {subtaskSaving ? "Adding…" : "Add subtask"}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section aria-labelledby="task-dependencies-title" className="border-t border-[var(--fv-border)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 id="task-dependencies-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--fv-text)]">
                <GitBranch size={16} aria-hidden="true" /> Depends on
              </h3>
              <span className="text-xs tabular-nums text-[var(--fv-text-muted)]">{dependencies.length}</span>
            </div>
            {detailsLoading ? <p className="py-4 text-sm text-[var(--fv-text-muted)]" role="status">Loading dependencies…</p> : dependencies.length ? (
              <ul className="mt-3 divide-y divide-[var(--fv-border)]">
                {dependencies.map((dependency) => {
                  const prerequisite = dependency.dependsOnTask;
                  const complete = prerequisite?.status === "COMPLETED";
                  return <li key={dependency.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-[var(--fv-text)]">{prerequisite?.title || "Task"}</p>
                      <p className={`mt-1 text-xs ${complete ? "text-emerald-500" : "text-amber-500"}`}>{complete ? "Complete" : "Must be completed first"}</p>
                    </div>
                    {task.canManage && <button type="button" onClick={() => handleRemoveDependency(dependency)} aria-label={`Remove prerequisite ${prerequisite?.title || "task"}`} className="rounded-lg p-2 text-[var(--fv-text-muted)] hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-rose-400"><X size={15} /></button>}
                  </li>;
                })}
              </ul>
            ) : <p className="py-4 text-sm text-[var(--fv-text-muted)]">No prerequisite tasks.</p>}
            {unfinishedDependencies.length > 0 && <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-500">Complete the prerequisite tasks before marking this task done.</p>}
            {dependencyError && <p className="mt-2 text-sm text-rose-400" role="alert">{dependencyError}</p>}
            {task.canManage && (
              <form onSubmit={handleAddDependency} className="mt-3 flex flex-wrap gap-2 border-t border-[var(--fv-border)] pt-3">
                <label htmlFor="task-dependency" className="sr-only">Choose a prerequisite task</label>
                <select id="task-dependency" value={selectedDependencyId} onChange={(event) => setSelectedDependencyId(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-3 text-sm text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40">
                  <option value="">Choose a project task…</option>
                  {availableTasks.filter((candidate) => !dependencies.some((dependency) => dependency.dependsOnTaskId === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                </select>
                <button type="submit" disabled={!selectedDependencyId || dependencySaving || detailsLoading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--fv-border)] px-3 text-xs font-semibold text-[var(--fv-text-secondary)] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"><Link2 size={14} />{dependencySaving ? "Adding…" : "Add dependency"}</button>
              </form>
            )}
            {!task.canManage && <p className="mt-2 text-xs text-[var(--fv-text-muted)]">Only project owners and admins can change task dependencies.</p>}
          </section>

          <section aria-labelledby="task-comments-title" className="border-t border-[var(--fv-border)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 id="task-comments-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--fv-text)]">
                <MessageSquare size={16} aria-hidden="true" /> Discussion
              </h3>
              <span className="text-xs tabular-nums text-[var(--fv-text-muted)]">{comments.length}</span>
            </div>
            {detailsLoading ? (
              <p className="py-5 text-sm text-[var(--fv-text-muted)]" role="status">Loading discussion…</p>
            ) : detailsError ? (
              <p className="py-4 text-sm text-rose-400" role="alert">{detailsError}</p>
            ) : comments.length ? (
              <div className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <article key={comment.id} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent-soft)] text-xs font-semibold text-[var(--fv-accent)]" aria-hidden="true">
                      {getInitials(comment.user?.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-[var(--fv-text)]">{comment.user?.name || "Team member"}</span>
                        <time dateTime={comment.createdAt} className="text-[11px] text-[var(--fv-text-muted)]">{new Date(comment.createdAt).toLocaleString()}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--fv-text-secondary)]">{comment.content}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="py-5 text-sm text-[var(--fv-text-muted)]">No comments yet. Start the discussion.</p>}

            <form onSubmit={handleSubmitComment} className="mt-4 space-y-2">
              <label htmlFor="task-comment" className="sr-only">Add a comment</label>
              <textarea
                id="task-comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Write a comment…"
                className="w-full resize-y rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-3 text-sm text-[var(--fv-text)] outline-none placeholder:text-[var(--fv-text-muted)] focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
              />
              {commentError && <p className="text-sm text-rose-400" role="alert">{commentError}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--fv-text-muted)]">{commentText.length}/2000</span>
                <button
                  type="submit"
                  disabled={!commentText.trim() || commentSaving || detailsLoading || Boolean(detailsError)}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--fv-accent)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={14} aria-hidden="true" /> {commentSaving ? "Posting…" : "Post comment"}
                </button>
              </div>
            </form>
          </section>

          <section aria-labelledby="task-activity-title" className="border-t border-[var(--fv-border)] pt-5">
            <h3 id="task-activity-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--fv-text)]">
              <Activity size={16} aria-hidden="true" /> Activity
            </h3>
            {detailsLoading ? <p className="py-4 text-sm text-[var(--fv-text-muted)]">Loading activity…</p> : activities.length ? (
              <ol className="mt-4 space-y-4">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--fv-accent)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm leading-5 text-[var(--fv-text-secondary)]">{activity.details || activity.type.replaceAll("_", " ").toLowerCase()}</p>
                      <p className="mt-1 text-[11px] text-[var(--fv-text-muted)]">{activity.user?.name || "System"} · {new Date(activity.createdAt).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="py-4 text-sm text-[var(--fv-text-muted)]">No activity recorded yet.</p>}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--fv-border)] bg-[var(--fv-surface)] p-4 md:p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--fv-border)] px-5 py-2.5 text-sm font-medium text-[var(--fv-text-secondary)] transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#7068FF]"
          >
            Close
          </button>

          {task.canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                className="flex items-center gap-2 rounded-xl bg-[var(--fv-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF]"
              >
                <Pencil size={15} />
                Edit Task
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Delete confirmation dialog
function DeleteConfirmationModal({ onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-task-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Trash2 size={21} />
          </div>

          <div>
            <h2
              id="delete-task-title"
              className="text-lg font-bold text-slate-800"
            >
              Delete Task?
            </h2>

            <p className="text-xs text-slate-400">
              Confirmation required
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-600">
          Are you sure you want to delete this task?
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Individual draggable task card
function TaskCard({
  task,
  onDeleteTask,
  onEditTask,
  onOpenTask
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    disabled: !task.canChangeStatus
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: task.canChangeStatus ? "none" : "auto"
  };

  const StatusIcon = statusIcons[task.status];
  const assignee = task.assignee;

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "Completed";

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(task.canChangeStatus ? listeners : {})}
      onClick={() => onOpenTask(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenTask(task);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${task.title}`}
      className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${
        task.canChangeStatus
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer"
      }`}
    >
      {/* Task title and actions */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800">{task.title}</h3>
          {task.parentTask?.title && (
            <p className="mt-1 truncate text-xs text-slate-500">Subtask of {task.parentTask.title}</p>
          )}
          {task.labels?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Task labels">
              {task.labels.map((label) => <li key={label} className="inline-flex items-center gap-1 rounded-full border border-[var(--fv-border)] bg-[var(--fv-surface-raised)] px-2 py-1 text-[10px] font-medium text-[var(--fv-text-secondary)]"><Tags size={11} aria-hidden="true" />{label}</li>)}
            </ul>
          )}
          {(task.estimatedMinutes != null || (task.actualMinutes ?? 0) > 0) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} aria-hidden="true" />{task.estimatedMinutes != null ? `Est. ${formatMinutes(task.estimatedMinutes)}` : "Time logged"}{task.actualMinutes > 0 ? ` · ${formatMinutes(task.actualMinutes)} logged` : ""}</p>
          )}
        </div>

        {task.canManage && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="text-slate-400 hover:text-[#6258E8] cursor-pointer"
              title="Edit task"
            >
              <Pencil size={16} />
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              className="text-slate-400 hover:text-red-500 cursor-pointer"
              title="Delete task"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-slate-500 mt-2">
          {task.description}
        </p>
      )}

      {/* Project */}
      <p className="text-sm text-slate-500 mt-3">
        {task.project}
      </p>

      {/* Assignee */}
      <div className="flex items-center gap-3 mt-4 p-3 bg-slate-50 rounded-xl">
        {assignee ? (
          <>
            <div className="w-9 h-9 rounded-full bg-[#7068FF]/10 text-[#6258E8] flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(assignee.name)}
            </div>

            <div className="min-w-0">
              <p className="text-xs text-slate-400">
                Assigned to
              </p>

              <p className="text-sm font-semibold text-slate-700 truncate">
                {assignee.name}
              </p>

              {assignee.email && (
                <p className="text-xs text-slate-400 truncate">
                  {assignee.email}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <User size={17} />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Assigned to
              </p>

              <p className="text-sm text-slate-500">
                Unassigned
              </p>
            </div>
          </>
        )}
      </div>

      {/* Due Date */}
      {formattedDate && (
        <div
          className={`flex items-center gap-2 mt-3 text-xs ${
            isOverdue
              ? "text-red-600 font-semibold"
              : "text-slate-500"
          }`}
        >
          <CalendarDays size={15} />

          <span>
            {isOverdue ? "Overdue: " : "Due: "}
            {formattedDate}
          </span>
        </div>
      )}

      {/* Priority and Status */}
      <div className="flex items-center justify-between mt-4">
        <span
          className={`text-xs px-3 py-1 rounded-full ${
            priorityColors[task.priority] ||
            "bg-slate-100 text-slate-600"
          }`}
        >
          {task.priority}
        </span>

        {StatusIcon && (
          <StatusIcon size={18} className="text-[#6258E8]" />
        )}
      </div>
    </div>
  );
}

// Individual Kanban column
function KanbanColumn({
  column,
  tasks,
  onDeleteTask,
  onEditTask,
  onOpenTask
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  });

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-800">
          {column.title}
        </h2>

        <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[300px] p-3 rounded-xl space-y-3 transition-colors ${
          isOver ? "bg-[#7068FF]/10" : "bg-slate-100"
        }`}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
              onOpenTask={onOpenTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">
            Drop tasks here
          </p>
        )}
      </div>
    </div>
  );
}

// Main Kanban board
function KanbanBoard({
  tasks,
  onStatusChange,
  onDeleteTask,
  onEditTask,
  onTasksChanged
}) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Open confirmation instead of deleting immediately.
  function requestDeleteTask(taskId) {
    setDeleteCandidate(taskId);
  }

  // Delete only after the user confirms.
  function confirmDeleteTask() {
    if (!deleteCandidate) return;

    onDeleteTask(deleteCandidate);
    setDeleteCandidate(null);
    setSelectedTask(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over) return;

    const draggedTask = tasks.find(
      (task) => task.id === active.id
    );

    if (!draggedTask || !draggedTask.canChangeStatus) return;

    let newStatus = columns.find(
      (column) => column.id === String(over.id)
    )?.id;

    if (!newStatus) {
      const targetTask = tasks.find(
        (task) => String(task.id) === String(over.id)
      );

      if (!targetTask) return;

      newStatus = targetTask.status;
    }

    if (draggedTask.status !== newStatus) {
      onStatusChange(draggedTask.id, newStatus);
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.id
            );

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={columnTasks}
                onDeleteTask={requestDeleteTask}
                onEditTask={onEditTask}
                onOpenTask={setSelectedTask}
              />
            );
          })}
        </div>
      </DndContext>

      {selectedTask && (
        <TaskDetailsModal
          key={selectedTask.id}
          task={
            tasks.find((task) => task.id === selectedTask.id) ||
            selectedTask
          }
          onClose={() => setSelectedTask(null)}
          onStatusChange={onStatusChange}
          onEditTask={onEditTask}
          onDeleteTask={requestDeleteTask}
          onTasksChanged={onTasksChanged}
        />
      )}

      {deleteCandidate && (
        <DeleteConfirmationModal
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={confirmDeleteTask}
        />
      )}
    </>
  );
}

export default KanbanBoard;
