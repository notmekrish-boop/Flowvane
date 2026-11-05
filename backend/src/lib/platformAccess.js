import { prisma } from "./prisma.js";

export const PLATFORM_ADMIN_EMAIL = "kksssh2815@gmail.com";

export async function isPlatformAdministrator(userId) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email?.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
