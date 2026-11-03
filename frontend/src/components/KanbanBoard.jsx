
import { useState } from "react";

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
  ClipboardList
} from "lucide-react";

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
  onDeleteTask
}) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <ClipboardList size={21} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Task Details
              </h2>

              <p className="text-xs text-slate-400">
                View task information
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Task Title
            </p>

            <h3 className="text-xl font-bold text-slate-800">
              {task.title}
            </h3>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Description
            </p>

            <p className="text-sm text-slate-600">
              {task.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-2">
                Project
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {task.project}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-2">
                Priority
              </p>

              <span
                className={`inline-block text-xs px-3 py-1 rounded-full ${
                  priorityColors[task.priority] ||
                  "bg-slate-100 text-slate-600"
                }`}
              >
                {task.priority}
              </span>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Assigned To
            </p>

            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
              {assignee ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    {getInitials(assignee.name)}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {assignee.name}
                    </p>

                    <p className="text-xs text-slate-400">
                      {assignee.email || ""}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <User size={18} />
                  </div>

                  <p className="text-sm text-slate-500">
                    Unassigned
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Due Date
            </p>

            <div
              className={`flex items-center gap-2 text-sm ${
                isOverdue ? "text-red-600" : "text-slate-600"
              }`}
            >
              <CalendarDays size={17} />
              {formattedDate}

              {isOverdue && (
                <span className="font-semibold">(Overdue)</span>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Task Status
            </p>

            {task.canChangeStatus ? (
              <select
                value={task.status}
                onChange={(e) =>
                  onStatusChange(task.id, e.target.value)
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">
                {StatusIcon && <StatusIcon size={18} />}
                {task.status}
              </div>
            )}

            {task.canChangeStatus && !task.canManage && (
              <p className="text-xs text-slate-400 mt-2">
                You can update the status of tasks assigned to you.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap justify-between gap-3 p-5 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-white text-sm font-medium"
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
              >
                <Pencil size={15} />
                Edit Task
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 text-sm font-medium"
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
        <h3 className="font-semibold text-slate-800">
          {task.title}
        </h3>

        {task.canManage && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="text-slate-400 hover:text-blue-600 cursor-pointer"
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
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
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
          <StatusIcon size={18} className="text-blue-600" />
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
          isOver ? "bg-blue-100" : "bg-slate-100"
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
  onEditTask
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
          task={
            tasks.find((task) => task.id === selectedTask.id) ||
            selectedTask
          }
          onClose={() => setSelectedTask(null)}
          onStatusChange={onStatusChange}
          onEditTask={onEditTask}
          onDeleteTask={requestDeleteTask}
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
