
import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

const validStatuses = ["TODO", "IN_PROGRESS", "COMPLETED"];
const validPriorities = ["LOW", "MEDIUM", "HIGH"];

// GET ALL TASKS BELONGING TO USER'S OWNED PROJECTS
router.get("/", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        project: {
          ownerId: req.userId
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
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

    res.status(200).json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error("Fetch tasks error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch tasks."
    });
  }
});

// CREATE TASK INSIDE A PROJECT
router.post("/projects/:projectId/tasks", async (req, res) => {
  try {
    const { title, description, priority, dueDate, assigneeId } = req.body;

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

    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        ownerId: req.userId
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true }
      });

      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: "Assignee not found."
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
      }
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully!",
      task
    });

  } catch (error) {
    console.error("Create task error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create task."
    });
  }
});

// GET TASKS FOR A SPECIFIC PROJECT
router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        ownerId: req.userId
      },
      select: { id: true }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId: project.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error("Fetch project tasks error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch project tasks."
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

    if (!allowedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    )) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update."
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim() || title.trim().length > 150)
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

    const existingTask = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        project: {
          ownerId: req.userId
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    if (assigneeId) {
      if (typeof assigneeId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid assignee ID."
        });
      }

      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true }
      });

      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: "Assignee not found."
        });
      }
    }

    const task = await prisma.task.update({
      where: {
        id: existingTask.id
      },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null
        }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && {
          dueDate: parsedDueDate ?? null
        }),
        ...(assigneeId !== undefined && {
          assigneeId: assigneeId || null
        })
      }
    });

    res.status(200).json({
      success: true,
      message: "Task updated successfully!",
      task
    });

  } catch (error) {
    console.error("Update task error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update task."
    });
  }
});

// DELETE TASK
router.delete("/:id", async (req, res) => {
  try {
    const existingTask = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        project: {
          ownerId: req.userId
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    await prisma.task.delete({
      where: {
        id: existingTask.id
      }
    });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully!"
    });

  } catch (error) {
    console.error("Delete task error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete task."
    });
  }
});

export default router;
