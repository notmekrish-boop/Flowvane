
import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

// GET ALL PROJECTS BELONGING TO LOGGED-IN USER
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        ownerId: req.userId
      },
      include: {
        _count: {
          select: {
            tasks: true,
            members: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({
      success: true,
      projects
    });

  } catch (error) {
    console.error("Fetch projects error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch projects."
    });
  }
});

// CREATE PROJECT
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required."
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Project name cannot exceed 100 characters."
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

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: req.userId
      }
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully!",
      project
    });

  } catch (error) {
    console.error("Create project error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create project."
    });
  }
});

// GET SINGLE PROJECT
router.get("/:id", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        ownerId: req.userId
      },
      include: {
        tasks: true,
        members: true
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    res.status(200).json({
      success: true,
      project
    });

  } catch (error) {
    console.error("Fetch project error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch project."
    });
  }
});

// UPDATE PROJECT
router.patch("/:id", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or description to update."
      });
    }

    const existingProject = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        ownerId: req.userId
      }
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    if (
      name !== undefined &&
      (typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Project name must be between 1 and 100 characters."
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

    const project = await prisma.project.update({
      where: {
        id: existingProject.id
      },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null
        })
      }
    });

    res.status(200).json({
      success: true,
      message: "Project updated successfully!",
      project
    });

  } catch (error) {
    console.error("Update project error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update project."
    });
  }
});

// DELETE PROJECT
router.delete("/:id", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        ownerId: req.userId
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    await prisma.project.delete({
      where: {
        id: project.id
      }
    });

    res.status(200).json({
      success: true,
      message: "Project deleted successfully!"
    });

  } catch (error) {
    console.error("Delete project error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete project."
    });
  }
});

export default router;
