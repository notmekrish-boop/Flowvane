import { prisma } from "../lib/prisma.js";
import { isPlatformAdministrator } from "../lib/platformAccess.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

let cleanupInProgress = false;
const cleanupTimer = setInterval(async () => {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  } catch (error) {
    console.error("Rate-limit bucket cleanup failed:", error);
  } finally {
    cleanupInProgress = false;
  }
}, 60_000);
cleanupTimer.unref?.();

export function createRateLimiter({ windowMs, max, keyPrefix, keyGenerator, policyResolver }) {
  return async function rateLimit(req, res, next) {
    let policy = { windowMs, max, identity: keyGenerator(req) };
    if (policyResolver) {
      try {
        const resolved = await policyResolver(req);
        if (resolved?.bypass) return next();
        if (resolved) policy = { ...policy, ...resolved };
      } catch {
        // Policy lookup failures fall back to the default limit; DB failures fail closed below.
      }
    }

    const key = `${keyPrefix}:${String(policy.identity || "unknown")}`;
    const now = Date.now();

    try {
      const [bucket] = await prisma.$queryRaw`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "updatedAt")
        VALUES (${key}, 1, ${new Date(now + policy.windowMs)}, NOW())
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN 1
            ELSE "RateLimitBucket"."count" + 1
          END,
          "expiresAt" = CASE
            WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN EXCLUDED."expiresAt"
            ELSE "RateLimitBucket"."expiresAt"
          END,
          "updatedAt" = NOW()
        RETURNING "count", "expiresAt"
      `;

      const remaining = Math.max(0, policy.max - bucket.count);
      const resetSeconds = Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now) / 1000));
      res.setHeader("RateLimit-Limit", String(policy.max));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.expiresAt.getTime() / 1000)));

      if (bucket.count > policy.max) {
        res.setHeader("Retry-After", String(resetSeconds));
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please wait before trying again.",
          retryAfterSeconds: resetSeconds
        });
      }
      return next();
    } catch (error) {
      console.error("Rate-limit check failed:", error);
      return res.status(503).json({
        success: false,
        message: "Request protection is temporarily unavailable. Please try again shortly."
      });
    }
  };
}

const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";
const accountId = (req) => req.userId || clientIp(req);

async function planForWorkspace(workspaceId, userId) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: {
      workspace: {
        select: {
          id: true,
          plan: { select: { aiRequestsPerWindow: true, aiWindowSeconds: true } }
        }
      }
    }
  });
  if (!membership) return null;
  const plan = membership.workspace.plan;
  return {
    identity: `workspace:${membership.workspace.id}`,
    max: plan.aiRequestsPerWindow,
    windowMs: plan.aiWindowSeconds * 1000
  };
}

async function resolveAiPolicy(req) {
  if (await isPlatformAdministrator(req.userId)) return { bypass: true };

  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : "";
  if (workspaceId) {
    const policy = await planForWorkspace(workspaceId, req.userId);
    if (policy) return policy;
  }

  const projectId = req.body?.projectId || req.params?.projectId;
  if (typeof projectId === "string" && projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...workspaceProjectAccess(req.userId) },
      select: { workspaceId: true }
    });
    if (project) {
      const policy = await planForWorkspace(project.workspaceId, req.userId);
      if (policy) return policy;
    }
  }

  const noteId = req.body?.noteId || req.params?.noteId;
  if (typeof noteId === "string" && noteId) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId: req.userId }, select: { projectId: true } });
    if (note?.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: note.projectId, ...workspaceProjectAccess(req.userId) },
        select: { workspaceId: true }
      });
      if (project) {
        const policy = await planForWorkspace(project.workspaceId, req.userId);
        if (policy) return policy;
      }
    }
  }

  const freePlan = await prisma.planQuota.findUnique({ where: { code: "FREE" } });
  return {
    identity: `user:${accountId(req)}`,
    max: freePlan?.aiRequestsPerWindow ?? 20,
    windowMs: (freePlan?.aiWindowSeconds ?? 600) * 1000
  };
}

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyPrefix: "auth",
  keyGenerator: clientIp
});

export const registrationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "registration",
  keyGenerator: clientIp
});

export const aiUsageRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "ai",
  keyGenerator: accountId,
  policyResolver: resolveAiPolicy
});
