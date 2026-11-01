
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

import { Trash2, Circle, Clock, CheckCircle2 } from "lucide-react";

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

// Individual draggable task card
function TaskCard({ task, onDeleteTask }) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none"
  };

  const StatusIcon = statusIcons[task.status];

  return (

    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing"
    >

      <div className="flex justify-between items-start">

        <h3 className="font-semibold text-slate-800">
          {task.title}
        </h3>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDeleteTask(task.id)}
          className="text-slate-400 hover:text-red-500 cursor-pointer"
          title="Delete task"
        >
          <Trash2 size={17} />
        </button>

      </div>

      <p className="text-sm text-slate-500 mt-3">
        {task.project}
      </p>

      <div className="flex items-center justify-between mt-4">

        <span
          className={`text-xs px-3 py-1 rounded-full ${priorityColors[task.priority]}`}
        >
          {task.priority}
        </span>

        <StatusIcon size={18} className="text-blue-600" />

      </div>

    </div>

  );
}


// Individual Kanban column
function KanbanColumn({ column, tasks, onDeleteTask }) {

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
function KanbanBoard({ tasks, onStatusChange, onDeleteTask }) {

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

    if (!draggedTask) return;

    // Check whether dropped directly on a column
    let newStatus = columns.find(
      (column) => column.id === String(over.id)
    )?.id;

    // Otherwise, check the task card it was dropped on
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
              onDeleteTask={onDeleteTask}
            />

          );

        })}

      </div>

    </DndContext>

  );

}

export default KanbanBoard;
