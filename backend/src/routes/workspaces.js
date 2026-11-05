import express from "express";
import { prisma } from "../lib/prisma.js";
import { removeUserFromWorkspaceRoom } from "../realtime/projectChatSocket.js";

const router = express.Router();
const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true, lastSeenAt: true } }
};

async function getMembership(workspaceId, userId) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true }
  });
}

function canManage(membership) {
  return membership?.role === "OWNER" || membership?.role === "ADMIN";
}

router.get("/", async (req, res) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.userId },
      include: { workspace: { include: { _count: { select: { members: true, projects: true } } } } },
      orderBy: { joinedAt: "asc" }
    });
    return res.json({
      success: true,
      workspaces: memberships.map(({ workspace, role }) => ({ ...workspace, role }))
    });
  } catch (error) {
    console.error("Fetch workspaces error:", error);
    return res.status(500).json({ success: false, message: "Unable to load workspaces." });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: "Workspace name must be between 1 and 80 characters." });
    }
    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: req.userId,
        members: { create: { userId: req.userId, role: "OWNER" } }
      }
    });
    return res.status(201).json({ success: true, workspace: { ...workspace, role: "OWNER" } });
  } catch (error) {
    console.error("Create workspace error:", error);
    return res.status(500).json({ success: false, message: "Unable to create workspace." });
  }
});

router.get("/:id/members", async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.userId);
    if (!membership) return res.status(404).json({ success: false, message: "Workspace not found." });
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: membership.workspaceId },
      select: memberSelect,
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
    });
    return res.json({ success: true, members });
  } catch (error) {
    console.error("Fetch workspace members error:", error);
    return res.status(500).json({ success: false, message: "Unable to load workspace members." });
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.userId);
    if (!canManage(membership)) return res.status(403).json({ success: false, message: "Only workspace owners and admins can invite members." });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Provide a valid email address." });
    }
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: "No registered user found with this email." });
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: membership.workspaceId, userId: user.id },
      select: memberSelect
    });
    return res.status(201).json({ success: true, member });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ success: false, message: "This user is already a workspace member." });
    console.error("Add workspace member error:", error);
    return res.status(500).json({ success: false, message: "Unable to add workspace member." });
  }
});

router.patch("/:id/members/:memberId", async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.userId);
    if (membership?.role !== "OWNER") return res.status(403).json({ success: false, message: "Only the workspace owner can change admin roles." });
    const role = req.body?.role;
    if (role !== "ADMIN" && role !== "MEMBER") return res.status(400).json({ success: false, message: "Role must be ADMIN or MEMBER." });
    const target = await prisma.workspaceMember.findFirst({ where: { id: req.params.memberId, workspaceId: membership.workspaceId } });
    if (!target) return res.status(404).json({ success: false, message: "Workspace member not found." });
    if (target.role === "OWNER") return res.status(400).json({ success: false, message: "The workspace owner role cannot be changed here." });
    const updated = await prisma.workspaceMember.update({ where: { id: target.id }, data: { role }, select: memberSelect });
    return res.json({ success: true, member: updated });
  } catch (error) {
    console.error("Update workspace member error:", error);
    return res.status(500).json({ success: false, message: "Unable to update workspace role." });
  }
});

router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.userId);
    if (!canManage(membership)) return res.status(403).json({ success: false, message: "Only workspace owners and admins can remove members." });
    const target = await prisma.workspaceMember.findFirst({ where: { id: req.params.memberId, workspaceId: membership.workspaceId } });
    if (!target) return res.status(404).json({ success: false, message: "Workspace member not found." });
    if (target.role === "OWNER") return res.status(400).json({ success: false, message: "Transfer ownership before removing the workspace owner." });
    if (membership.role === "ADMIN" && target.role === "ADMIN") return res.status(403).json({ success: false, message: "Admins cannot remove another admin." });
    const ownedProjects = await prisma.project.findMany({
      where: { workspaceId: membership.workspaceId, ownerId: target.userId },
      select: { id: true },
      take: 1
    });
    if (ownedProjects.length) return res.status(409).json({ success: false, message: "This member owns projects in the workspace. Delete those projects first, or keep the member in the workspace." });
    await prisma.workspaceMember.delete({ where: { id: target.id } });
    await removeUserFromWorkspaceRoom(membership.workspaceId, target.userId);
    return res.json({ success: true, message: "Workspace member removed." });
  } catch (error) {
    console.error("Remove workspace member error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove workspace member." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.userId);
    if (!canManage(membership)) return res.status(403).json({ success: false, message: "Only workspace owners and admins can edit workspace details." });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 80) return res.status(400).json({ success: false, message: "Workspace name must be between 1 and 80 characters." });
    const workspace = await prisma.workspace.update({ where: { id: membership.workspaceId }, data: { name } });
    return res.json({ success: true, workspace: { ...workspace, role: membership.role } });
  } catch (error) {
    console.error("Update workspace error:", error);
    return res.status(500).json({ success: false, message: "Unable to update workspace." });
  }
});

export default router;
