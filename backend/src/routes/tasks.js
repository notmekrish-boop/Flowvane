import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

const validStatuses = ["TODO", "IN_PROGRESS", "COMPLETED"];
const validPriorities = ["LOW", "MEDIUM", "HIGH"];

// Find a project the logged-in user can access.
async function findAccessibleProject(projectId, userId) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
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

// Check whether a user is the owner or a member of this project.
async function isValidAssignee(projectId, assigneeId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
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
      assigneeId
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
        dueDate: parsedDueDate,
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
      assigneeId
    } = req.body;

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assigneeId"
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
        ...(dueDate !== undefined && {
          dueDate: parsedDueDate ?? null
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
