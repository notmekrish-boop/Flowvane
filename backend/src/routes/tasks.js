import express from "express";
import { prisma } from "../lib/prisma.js";
import { emitUserEvent } from "../realtime/projectChatSocket.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

const router = express.Router();

const validStatuses = ["TODO", "IN_PROGRESS", "COMPLETED"];
const validPriorities = ["LOW", "MEDIUM", "HIGH"];

function normalizeTaskLabels(labels) {
  if (!Array.isArray(labels) || labels.length > 20) return null;
  const unique = new Map();
  for (const value of labels) {
    if (typeof value !== "string") return null;
    const label = value.trim();
    if (!label) continue;
    if (label.length > 32) return null;
    const key = label.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, label);
  }
  return [...unique.values()];
}

function normalizeCustomFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const entries = Object.entries(fields);
  if (entries.length > 20) return null;
  const normalized = {};
  const seen = new Set();
  for (const [rawKey, rawValue] of entries) {
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    const normalizedKey = key.toLocaleLowerCase();
    if (!key || key.length > 40 || ["__proto__", "prototype", "constructor"].includes(normalizedKey) || seen.has(normalizedKey)) return null;
    if (typeof rawValue !== "string" || rawValue.length > 500) return null;
    seen.add(normalizedKey);
    if (rawValue.trim()) normalized[key] = rawValue.trim();
  }
  return normalized;
}

// Find a project the logged-in user can access.
async function findAccessibleProject(projectId, userId) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ...workspaceProjectAccess(userId),
      OR: [
        { ownerId: userId },
        {
          members: {
            some: { userId }
          }
        }
      ]
    },
    include: {
      members: {
        where: { userId },
        select: { role: true }
      }
    }
  });
}

// Owners and project admins can manage project tasks.
function canManageProject(project, userId) {
  if (project.ownerId === userId) return true;

  return project.members.some(
    (member) => member.role === "ADMIN"
  );
}

function dependencyCreatesCycle(dependencies, taskId, dependsOnTaskId) {
  const adjacency = new Map();
  for (const dependency of dependencies) {
    const current = adjacency.get(dependency.taskId) || [];
    current.push(dependency.dependsOnTaskId);
    adjacency.set(dependency.taskId, current);
  }

  const pending = [dependsOnTaskId];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(adjacency.get(current) || []));
  }
  return false;
}

// Check whether a user is the owner or a member of this project.
async function isValidAssignee(projectId, assigneeId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...workspaceProjectAccess(assigneeId),
      OR: [
        { ownerId: assigneeId },
        {
          members: {
            some: { userId: assigneeId }
          }
        }
      ]
    },
    select: { id: true }
  });

  return Boolean(project);
}

// Create an assignment notification.
// Notification failures are logged but do not undo a successful task operation.
async function createTaskAssignedNotification({
  recipientId,
  actorId,
  taskId,
  projectId,
  taskTitle
}) {
  if (!recipientId || recipientId === actorId) return;

  try {
    await prisma.notification.create({
      data: {
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: `You have been assigned a new task: ${taskTitle}`,
        recipientId,
        actorId,
        taskId,
        projectId
      }
    });
    emitUserEvent(recipientId, "notification:changed", {});
  } catch (error) {
    console.error("Create task assignment notification error:", error);
  }
}

// Record task activity. Logging failures should not undo the task operation.
async function createTaskActivity({ taskId, userId, type, details }) {
  try {
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: userId || null,
        type,
        details: details || null
      }
    });
  } catch (error) {
    console.error("Create task activity error:", error);
  }
}

// GET ALL TASKS ACCESSIBLE TO LOGGED-IN USER
router.get("/", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        project: {
          ...workspaceProjectAccess(req.userId),
          OR: [
            { ownerId: req.userId },
            {
              members: {
                some: { userId: req.userId }
              }
            }
          ]
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: {
              where: { userId: req.userId },
              select: { role: true }
            }
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parentTask: {
          select: { id: true, title: true }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Fetch tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch tasks."
    });
  }
});

// CREATE TASK INSIDE A PROJECT
router.post("/projects/:projectId/tasks", async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      reminderAt,
      assigneeId,
      labels,
      estimatedMinutes,
      actualMinutes,
      customFields
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required."
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: "Task title cannot exceed 150 characters."
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text."
      });
    }

    const taskPriority = priority ?? "MEDIUM";

    if (!validPriorities.includes(taskPriority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority."
      });
    }

    const parsedLabels = labels === undefined ? [] : normalizeTaskLabels(labels);
    if (parsedLabels === null) {
      return res.status(400).json({ success: false, message: "Use up to 20 text labels, each 32 characters or fewer." });
    }

    if (estimatedMinutes !== undefined && estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 1000000)) {
      return res.status(400).json({ success: false, message: "Estimated time must be a whole number between 0 and 1,000,000 minutes." });
    }
    if (actualMinutes !== undefined && (!Number.isInteger(actualMinutes) || actualMinutes < 0 || actualMinutes > 1000000)) {
      return res.status(400).json({ success: false, message: "Logged time must be a whole number between 0 and 1,000,000 minutes." });
    }
    const parsedCustomFields = customFields === undefined ? {} : normalizeCustomFields(customFields);
    if (parsedCustomFields === null) return res.status(400).json({ success: false, message: "Use up to 20 custom fields with names up to 40 characters and text values up to 500 characters." });

    if (
      assigneeId !== undefined &&
      assigneeId !== null &&
      typeof assigneeId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignee ID."
      });
    }

    let parsedDueDate;

    if (dueDate !== undefined && dueDate !== null && dueDate !== "") {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid due date."
        });
      }
    }

    let parsedReminderAt;
    if (reminderAt !== undefined && reminderAt !== null && reminderAt !== "") {
      parsedReminderAt = new Date(reminderAt);
      if (Number.isNaN(parsedReminderAt.getTime())) return res.status(400).json({ success: false, message: "Invalid reminder date and time." });
    }

    const project = await findAccessibleProject(
      req.params.projectId,
      req.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied."
      });
    }

    if (!canManageProject(project, req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only project owners and admins can create tasks."
      });
    }

    if (assigneeId) {
      const validAssignee = await isValidAssignee(
        project.id,
        assigneeId
      );

      if (!validAssignee) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project."
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: taskPriority,
        labels: parsedLabels,
        estimatedMinutes: estimatedMinutes ?? null,
        actualMinutes: actualMinutes ?? 0,
        customFields: parsedCustomFields,
        dueDate: parsedDueDate,
        reminderAt: parsedReminderAt,
        projectId: project.id,
        assigneeId: assigneeId || null
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parentTask: {
          select: { id: true, title: true }
        }
      }
    });

    // Notify the assigned user if the task was assigned to someone else.
    if (task.assigneeId) {
      await createTaskAssignedNotification({
        recipientId: task.assigneeId,
        actorId: req.userId,
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.title
      });
    }

    await createTaskActivity({
      taskId: task.id,
      userId: req.userId,
      type: "TASK_CREATED",
      details: `Created task "${task.title}".`
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully!",
      task
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create task."
    });
  }
});

// GET TASKS FOR A SPECIFIC PROJECT
router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    const project = await findAccessibleProject(
      req.params.projectId,
      req.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied."
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId: project.id
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parentTask: {
          select: { id: true, title: true }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Fetch project tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch project tasks."
    });
  }
});

// GET DIRECT SUBTASKS FOR A TASK
router.get("/:taskId/subtasks", async (req, res) => {
  try {
    const parent = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: { id: true, projectId: true }
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    const project = await findAccessibleProject(parent.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied." });
    }

    const subtasks = await prisma.task.findMany({
      where: { parentTaskId: parent.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    return res.status(200).json({ success: true, subtasks });
  } catch (error) {
    console.error("Fetch subtasks error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch subtasks." });
  }
});

// CREATE A ONE-LEVEL SUBTASK
router.post("/:taskId/subtasks", async (req, res) => {
  try {
    const { title, description, priority, dueDate, assigneeId } = req.body;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 150) {
      return res.status(400).json({ success: false, message: "Subtask title is required and must be 150 characters or fewer." });
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({ success: false, message: "Description must be text." });
    }
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid task priority." });
    }
    if (assigneeId !== undefined && assigneeId !== null && typeof assigneeId !== "string") {
      return res.status(400).json({ success: false, message: "Invalid assignee ID." });
    }

    let parsedDueDate = null;
    if (dueDate !== undefined && dueDate !== null && dueDate !== "") {
      parsedDueDate = new Date(dueDate);
      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid due date." });
      }
    }

    const parent = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: { id: true, title: true, projectId: true, parentTaskId: true }
    });
    if (!parent) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }
    if (parent.parentTaskId) {
      return res.status(400).json({ success: false, message: "Subtasks can only be created from a parent task." });
    }

    const project = await findAccessibleProject(parent.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied." });
    }
    if (!canManageProject(project, req.userId)) {
      return res.status(403).json({ success: false, message: "Only project owners and admins can create subtasks." });
    }
    if (assigneeId) {
      const validAssignee = await isValidAssignee(parent.projectId, assigneeId);
      if (!validAssignee) {
        return res.status(400).json({ success: false, message: "Assignee must belong to this project." });
      }
    }

    const subtask = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "MEDIUM",
        dueDate: parsedDueDate,
        projectId: parent.projectId,
        parentTaskId: parent.id,
        assigneeId: assigneeId || null
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });

    await createTaskActivity({
      taskId: subtask.id,
      userId: req.userId,
      type: "TASK_CREATED",
      details: `Subtask created under "${parent.title}".`
    });
    if (subtask.assigneeId) {
      await createTaskAssignedNotification({
        recipientId: subtask.assigneeId,
        actorId: req.userId,
        taskId: subtask.id,
        projectId: parent.projectId,
        taskTitle: subtask.title
      });
    }

    return res.status(201).json({ success: true, message: "Subtask created successfully.", subtask });
  } catch (error) {
    console.error("Create subtask error:", error);
    return res.status(500).json({ success: false, message: "Unable to create subtask." });
  }
});

// LIST DEPENDENCIES AND SAME-PROJECT TASKS THAT CAN BE LINKED.
router.get("/:taskId/dependencies", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true, projectId: true } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    const project = await findAccessibleProject(task.projectId, req.userId);
    if (!project) return res.status(404).json({ success: false, message: "Project not found or access denied." });

    const [dependencies, availableTasks] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { taskId: task.id },
        include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.task.findMany({
        where: { projectId: project.id, id: { not: task.id } },
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    ]);
    return res.json({ success: true, dependencies, availableTasks });
  } catch (error) {
    console.error("Fetch task dependencies error:", error);
    return res.status(500).json({ success: false, message: "Unable to load task dependencies." });
  }
});

// ADD A TASK PREREQUISITE.
router.post("/:taskId/dependencies", async (req, res) => {
  try {
    const { dependsOnTaskId } = req.body || {};
    if (typeof dependsOnTaskId !== "string" || !dependsOnTaskId) {
      return res.status(400).json({ success: false, message: "Choose a task this one depends on." });
    }
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true, title: true, projectId: true } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    const project = await findAccessibleProject(task.projectId, req.userId);
    if (!project) return res.status(404).json({ success: false, message: "Project not found or access denied." });
    if (!canManageProject(project, req.userId)) return res.status(403).json({ success: false, message: "Only project owners and admins can change dependencies." });
    if (task.id === dependsOnTaskId) return res.status(400).json({ success: false, message: "A task cannot depend on itself." });

    const prerequisite = await prisma.task.findFirst({
      where: { id: dependsOnTaskId, projectId: project.id },
      select: { id: true, title: true, status: true }
    });
    if (!prerequisite) return res.status(400).json({ success: false, message: "Dependencies must be tasks in the same project." });

    const existing = await prisma.taskDependency.findMany({
      where: { task: { projectId: project.id } },
      select: { taskId: true, dependsOnTaskId: true }
    });
    if (dependencyCreatesCycle(existing, task.id, prerequisite.id)) {
      return res.status(400).json({ success: false, message: "This dependency would create a cycle." });
    }

    const dependency = await prisma.taskDependency.create({
      data: { taskId: task.id, dependsOnTaskId: prerequisite.id },
      include: { dependsOnTask: { select: { id: true, title: true, status: true } } }
    });
    await createTaskActivity({ taskId: task.id, userId: req.userId, type: "TASK_UPDATED", details: `Added prerequisite: "${prerequisite.title}".` });
    return res.status(201).json({ success: true, dependency });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ success: false, message: "That dependency already exists." });
    console.error("Create task dependency error:", error);
    return res.status(500).json({ success: false, message: "Unable to add task dependency." });
  }
});

// REMOVE A TASK PREREQUISITE.
router.delete("/:taskId/dependencies/:dependsOnTaskId", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true, projectId: true } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    const project = await findAccessibleProject(task.projectId, req.userId);
    if (!project) return res.status(404).json({ success: false, message: "Project not found or access denied." });
    if (!canManageProject(project, req.userId)) return res.status(403).json({ success: false, message: "Only project owners and admins can change dependencies." });

    const dependency = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId: task.id, dependsOnTaskId: req.params.dependsOnTaskId } },
      include: { dependsOnTask: { select: { title: true } } }
    });
    if (!dependency) return res.status(404).json({ success: false, message: "Dependency not found." });
    await prisma.taskDependency.delete({ where: { id: dependency.id } });
    await createTaskActivity({ taskId: task.id, userId: req.userId, type: "TASK_UPDATED", details: `Removed prerequisite: "${dependency.dependsOnTask.title}".` });
    return res.json({ success: true, message: "Dependency removed." });
  } catch (error) {
    console.error("Delete task dependency error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove task dependency." });
  }
});

// GET COMMENTS FOR A TASK
router.get("/:taskId/comments", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: { id: true, projectId: true }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const project = await findAccessibleProject(task.projectId, req.userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied."
      });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId: task.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error("Fetch task comments error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch task comments."
    });
  }
});

// ADD A COMMENT TO A TASK
router.post("/:taskId/comments", async (req, res) => {
  try {
    const { content } = req.body;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty."
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 2000 characters."
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: {
        id: true,
        title: true,
        projectId: true
      }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const project = await findAccessibleProject(task.projectId, req.userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied."
      });
    }

    const comment = await prisma.taskComment.create({
      data: {
        content: content.trim(),
        taskId: task.id,
        userId: req.userId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    await createTaskActivity({
      taskId: task.id,
      userId: req.userId,
      type: "COMMENT_ADDED",
      details: `Added a comment to "${task.title}".`
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      comment
    });
  } catch (error) {
    console.error("Add task comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add task comment."
    });
  }
});

// GET ACTIVITY HISTORY FOR A TASK
router.get("/:taskId/activities", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: { id: true, projectId: true }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const project = await findAccessibleProject(task.projectId, req.userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied."
      });
    }

    const activities = await prisma.taskActivity.findMany({
      where: { taskId: task.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error("Fetch task activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch task activity."
    });
  }
});

// UPDATE TASK
router.patch("/:id", async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      reminderAt,
      assigneeId,
      labels,
      estimatedMinutes,
      actualMinutes,
      customFields
    } = req.body;

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "reminderAt",
      "assigneeId",
      "labels",
      "estimatedMinutes",
      "actualMinutes",
      "customFields"
    ];

    const suppliedFields = Object.keys(req.body);

    if (
      suppliedFields.length === 0 ||
      !suppliedFields.every((field) => allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid fields to update."
      });
    }

    if (
      title !== undefined &&
      (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task title."
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text."
      });
    }

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status."
      });
    }

    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority."
      });
    }

    const parsedLabels = labels === undefined ? undefined : normalizeTaskLabels(labels);
    if (labels !== undefined && parsedLabels === null) {
      return res.status(400).json({ success: false, message: "Use up to 20 text labels, each 32 characters or fewer." });
    }

    if (estimatedMinutes !== undefined && estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 1000000)) {
      return res.status(400).json({ success: false, message: "Estimated time must be a whole number between 0 and 1,000,000 minutes." });
    }
    if (actualMinutes !== undefined && (!Number.isInteger(actualMinutes) || actualMinutes < 0 || actualMinutes > 1000000)) {
      return res.status(400).json({ success: false, message: "Logged time must be a whole number between 0 and 1,000,000 minutes." });
    }
    const parsedCustomFields = customFields === undefined ? undefined : normalizeCustomFields(customFields);
    if (customFields !== undefined && parsedCustomFields === null) return res.status(400).json({ success: false, message: "Use up to 20 custom fields with names up to 40 characters and text values up to 500 characters." });

    if (
      assigneeId !== undefined &&
      assigneeId !== null &&
      typeof assigneeId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignee ID."
      });
    }

    let parsedDueDate;

    if (dueDate !== undefined && dueDate !== null && dueDate !== "") {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid due date."
        });
      }
    }

    let parsedReminderAt;
    if (reminderAt !== undefined && reminderAt !== null && reminderAt !== "") {
      parsedReminderAt = new Date(reminderAt);
      if (Number.isNaN(parsedReminderAt.getTime())) return res.status(400).json({ success: false, message: "Invalid reminder date and time." });
    }

    // Find the task first.
    const existingTask = await prisma.task.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    // Check whether the logged-in user can access the task's project.
    const accessibleProject = await findAccessibleProject(
      existingTask.projectId,
      req.userId
    );

    if (!accessibleProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied."
      });
    }

    const isManager = canManageProject(
      accessibleProject,
      req.userId
    );

    // Regular members can ONLY update the status of tasks assigned to them.
    if (!isManager) {
      const onlyUpdatingStatus =
        suppliedFields.length === 1 &&
        suppliedFields[0] === "status";

      if (!onlyUpdatingStatus) {
        return res.status(403).json({
          success: false,
          message: "Members can only update task status."
        });
      }

      if (existingTask.assigneeId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: "You can only update the status of tasks assigned to you."
        });
      }
    }

    if (status === "COMPLETED") {
      const blockers = await prisma.taskDependency.findMany({
        where: {
          taskId: existingTask.id,
          dependsOnTask: { status: { not: "COMPLETED" } }
        },
        include: { dependsOnTask: { select: { title: true } } }
      });
      if (blockers.length) {
        const names = blockers.map(({ dependsOnTask }) => dependsOnTask.title).join(", ");
        return res.status(409).json({ success: false, message: `Complete prerequisite tasks first: ${names}.` });
      }
    }

    // Validate a newly selected assignee.
    if (assigneeId) {
      const validAssignee = await isValidAssignee(
        existingTask.projectId,
        assigneeId
      );

      if (!validAssignee) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project."
        });
      }
    }

    const task = await prisma.task.update({
      where: {
        id: existingTask.id
      },
      data: {
        ...(title !== undefined && {
          title: title.trim()
        }),
        ...(description !== undefined && {
          description: description?.trim() || null
        }),
        ...(status !== undefined && {
          status
        }),
        ...(priority !== undefined && {
          priority
        }),
        ...(parsedLabels !== undefined && { labels: parsedLabels }),
        ...(estimatedMinutes !== undefined && { estimatedMinutes }),
        ...(actualMinutes !== undefined && { actualMinutes }),
        ...(parsedCustomFields !== undefined && { customFields: parsedCustomFields }),
        ...(dueDate !== undefined && {
          dueDate: parsedDueDate ?? null
        }),
        ...(reminderAt !== undefined && {
          reminderAt: parsedReminderAt ?? null,
          ...(existingTask.reminderAt?.getTime() !== parsedReminderAt?.getTime() && { reminderSentAt: null })
        }),
        ...(assigneeId !== undefined && {
          assigneeId: assigneeId || null
        })
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Notify only when the task is newly assigned or reassigned.
    const assignmentChanged =
      assigneeId !== undefined &&
      task.assigneeId &&
      task.assigneeId !== existingTask.assigneeId;

    if (assignmentChanged) {
      await createTaskAssignedNotification({
        recipientId: task.assigneeId,
        actorId: req.userId,
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.title
      });
    }

    // Record each changed field with its previous and new value.
    if (status !== undefined && status !== existingTask.status) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_STATUS_CHANGED",
        details: `Status changed: ${existingTask.status} → ${task.status}.`
      });
    }

    if (
      assigneeId !== undefined &&
      task.assigneeId !== existingTask.assigneeId
    ) {
      const oldAssignee = existingTask.assignee?.name || "Unassigned";
      const newAssignee = task.assignee?.name || "Unassigned";

      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_ASSIGNED",
        details: `Assignee changed: ${oldAssignee} → ${newAssignee}.`
      });
    }

    if (title !== undefined && title.trim() !== existingTask.title) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: `Title changed: "${existingTask.title}" → "${task.title}".`
      });
    }

    const oldDescription = existingTask.description || "Empty";
    const newDescription = task.description || "Empty";

    if (
      description !== undefined &&
      newDescription !== oldDescription
    ) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: `Description changed: "${oldDescription}" → "${newDescription}".`
      });
    }

    if (priority !== undefined && priority !== existingTask.priority) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: `Priority changed: ${existingTask.priority} → ${task.priority}.`
      });
    }

    if (parsedLabels !== undefined && JSON.stringify(parsedLabels) !== JSON.stringify(existingTask.labels)) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: "Task labels updated."
      });
    }

    if (estimatedMinutes !== undefined && estimatedMinutes !== existingTask.estimatedMinutes) {
      await createTaskActivity({ taskId: task.id, userId: req.userId, type: "TASK_UPDATED", details: `Estimated time changed: ${existingTask.estimatedMinutes ?? "Not set"} → ${estimatedMinutes ?? "Not set"} minutes.` });
    }
    if (actualMinutes !== undefined && actualMinutes !== existingTask.actualMinutes) {
      await createTaskActivity({ taskId: task.id, userId: req.userId, type: "TASK_UPDATED", details: `Logged time changed: ${existingTask.actualMinutes} → ${actualMinutes} minutes.` });
    }
    if (parsedCustomFields !== undefined && JSON.stringify(parsedCustomFields) !== JSON.stringify(existingTask.customFields)) {
      await createTaskActivity({ taskId: task.id, userId: req.userId, type: "TASK_UPDATED", details: "Task custom fields updated." });
    }

    const oldDueDate = existingTask.dueDate
      ? existingTask.dueDate.toLocaleDateString("en-IN")
      : "No due date";
    const newDueDate = task.dueDate
      ? task.dueDate.toLocaleDateString("en-IN")
      : "No due date";

    if (
      dueDate !== undefined &&
      oldDueDate !== newDueDate
    ) {
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: `Due date changed: ${oldDueDate} → ${newDueDate}.`
      });
    }

    if (reminderAt !== undefined && existingTask.reminderAt?.getTime() !== task.reminderAt?.getTime()) {
      const previousReminder = existingTask.reminderAt?.toLocaleString("en-IN") || "No reminder";
      const nextReminder = task.reminderAt?.toLocaleString("en-IN") || "No reminder";
      await createTaskActivity({
        taskId: task.id,
        userId: req.userId,
        type: "TASK_UPDATED",
        details: `Reminder changed: ${previousReminder} → ${nextReminder}.`
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task updated successfully!",
      task
    });
  } catch (error) {
    console.error("Update task error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update task."
    });
  }
});

// DELETE TASK
router.delete("/:id", async (req, res) => {
  try {
    const existingTask = await prisma.task.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const accessibleProject = await findAccessibleProject(
      existingTask.projectId,
      req.userId
    );

    if (!accessibleProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied."
      });
    }

    if (!canManageProject(accessibleProject, req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only project owners and admins can delete tasks."
      });
    }

    await prisma.task.delete({
      where: {
        id: existingTask.id
      }
    });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully!"
    });
  } catch (error) {
    console.error("Delete task error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete task."
    });
  }
});

export default router;
