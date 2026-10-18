import { prisma } from "@/lib/db";
import { handle, ok, parsePagination, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.ADMIN);
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url, 25);
  const search = url.searchParams.get("search");
  const role = url.searchParams.get("role");

  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search } },
            { displayName: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        state: true,
        isDemo: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      state: user.state,
      isDemo: user.isDemo,
      emailVerified: Boolean(user.emailVerifiedAt),
      attempts: user._count.attempts,
      createdAt: user.createdAt.toISOString(),
    })),
  });
});
