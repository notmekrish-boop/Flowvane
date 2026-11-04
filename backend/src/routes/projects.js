
import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

// Check whether user owns the project or is an ADMIN
async function canManageProject(projectId, userId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
              role: "ADMIN"
            }
          }
        }
      ]
    }
  });

  return project;
}

// GET ALL PROJECTS: owned projects + joined projects
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          {
            members: {
              some: { userId: req.userId }
            }
          }
        ]
      },
      include: {
        _count: {
          select: {
            tasks: true,
            members: true
          }
        },
        members: {
          where: { userId: req.userId },
          select: { role: true }
        }
      },
      orderBy: { createdAt: "desc" }
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

// GET PROJECT TEAM MEMBERS: all project members can view
router.get("/:id/members", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { ownerId: req.userId },
          {
            members: {
              some: { userId: req.userId }
            }
          }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { joinedAt: "asc" }
        }
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
      members: project.members
    });
  } catch (error) {
    console.error("Fetch project members error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch project members."
    });
  }
});

// ADD TEAM MEMBER: owner or ADMIN only
router.post("/:id/members", async (req, res) => {
  try {
    const { email } = req.body;

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const project = await canManageProject(
      req.params.id,
      req.userId
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage this project."
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase()
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email."
      });
    }

    if (user.id === project.ownerId) {
      return res.status(400).json({
        success: false,
        message: "The project owner cannot be added as a member."
      });
    }

    const member = await prisma.teamMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: "MEMBER"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: "Team member added successfully.",
      member
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "This user is already a member of the project."
      });
    }

    console.error("Add project member error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to add team member."
    });
  }
});

// REMOVE TEAM MEMBER: owner or ADMIN only
router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const { id, memberId } = req.params;

    const project = await canManageProject(id, req.userId);

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage this project."
      });
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        projectId: project.id
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found in this project."
      });
    }

    await prisma.teamMember.delete({
      where: { id: member.id }
    });

    res.status(200).json({
      success: true,
      message: "Team member removed successfully."
    });
  } catch (error) {
    console.error("Remove project member error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to remove team member."
    });
  }
});

// DASHBOARD ANALYTICS: task activity for projects visible to the signed-in user
// This endpoint returns recorded events only; it does not infer historical completions.
router.get("/analytics", async (req, res) => {
  try {
    const accessibleProjects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { members: { some: { userId: req.userId } } }
        ]
      },
      select: { id: true }
    });

    const projectIds = accessibleProjects.map((project) => project.id);

    if (projectIds.length === 0) {
      return res.status(200).json({ success: true, activities: [] });
    }

    const activities = await prisma.taskActivity.findMany({
      where: {
        task: { projectId: { in: projectIds } }
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true
          }
        },
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 2000
    });

    return res.status(200).json({
      success: true,
      activities
    });
  } catch (error) {
    console.error("Fetch dashboard analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch dashboard analytics."
    });
  }
});

// GET SINGLE PROJECT: all project members can view
router.get("/:id", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { ownerId: req.userId },
          {
            members: {
              some: { userId: req.userId }
            }
          }
        ]
      },
      include: {
        tasks: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
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

// UPDATE PROJECT: owner or ADMIN only
router.patch("/:id", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or description to update."
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

    const existingProject = await canManageProject(
      req.params.id,
      req.userId
    );

    if (!existingProject) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project."
      });
    }

    const project = await prisma.project.update({
      where: { id: existingProject.id },
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

// DELETE PROJECT: owner only
router.delete("/:id", async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        ownerId: req.userId
      }
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can delete this project."
      });
    }

    await prisma.project.delete({
      where: { id: project.id }
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
