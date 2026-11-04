import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();
const publicUser = { id: true, name: true, email: true, avatarUrl: true, createdAt: true };

router.get("/me", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: publicUser });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load profile." });
  }
});

router.patch("/me", async (req, res) => {
  try {
    const { name, avatarUrl } = req.body || {};
    const data = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
        return res.status(400).json({ success: false, message: "Name must be between 1 and 80 characters." });
      }
      data.name = name.trim();
    }
    if (avatarUrl !== undefined) {
      if (avatarUrl !== null && (typeof avatarUrl !== "string" || avatarUrl.length > 3_000_000 || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatarUrl))) {
        return res.status(400).json({ success: false, message: "Avatar must be a supported image under 2 MB." });
      }
      data.avatarUrl = avatarUrl;
    }
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "No profile changes provided." });
    const user = await prisma.user.update({ where: { id: req.userId }, data, select: publicUser });
    return res.json({ success: true, user, message: "Profile updated." });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update profile." });
  }
});

export default router;
