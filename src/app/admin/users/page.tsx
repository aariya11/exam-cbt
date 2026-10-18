import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { ROLES, isAtLeastRole } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Card, CardHeader, Input, LinkButton, Select, Table, Td, Th, buttonClass, statusTone } from "@/components/ui";
import { UserActions } from "@/components/admin/user-actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const ROLES_LIST = ["STUDENT", "QUESTION_EDITOR", "EXAM_MANAGER", "ADMIN", "SUPER_ADMIN"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) return null;
  const params = await searchParams;

  const search = (params.search ?? "").trim();
  const role = ROLES_LIST.includes(params.role ?? "") ? (params.role as string) : "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

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
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canManageRoles = isAtLeastRole(viewer.role, ROLES.SUPER_ADMIN);

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (role) query.set("role", role);
    query.set("page", String(target));
    return `/admin/users?${query.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Users</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {formatNumber(total)} account(s). Suspensions and role changes take effect immediately.
        </p>
      </div>

      <form method="GET" action="/admin/users" className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <Input name="search" defaultValue={search} placeholder="Search name, username or email…" />
        <Select name="role" defaultValue={role}>
          <option value="">All roles</option>
          <option value="STUDENT">Students</option>
          <option value="QUESTION_EDITOR">Question editors</option>
          <option value="EXAM_MANAGER">Exam managers</option>
          <option value="ADMIN">Administrators</option>
          <option value="SUPER_ADMIN">Super administrators</option>
        </Select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("secondary", "md")}>
            Filter
          </button>
          <Link href="/admin/users" className={buttonClass("ghost", "md")}>
            Reset
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader title="Accounts" description="Staff roles are visible to administrators only" />
        {users.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500 dark:text-ink-400">No users match the filters.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Email</Th>
                <Th className="text-right">Attempts</Th>
                <Th>Joined</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td>
                    <p className="font-medium text-ink-900 dark:text-ink-100">{user.displayName}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      @{user.username}
                      {user.state ? ` · ${user.state}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={user.role === "STUDENT" ? "neutral" : "brand"}>{user.role.replaceAll("_", " ").toLowerCase()}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(user.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED")}>{user.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-xs">
                    {user.email}
                    {user.emailVerifiedAt ? null : <span className="text-warn-500"> · unverified</span>}
                  </Td>
                  <Td className="nums text-right text-xs">{user._count.attempts}</Td>
                  <Td className="text-xs">{formatDate(user.createdAt)}</Td>
                  <Td className="text-right">
                    <UserActions
                      userId={user.id}
                      username={user.username}
                      role={user.role}
                      status={user.status}
                      canManageRoles={canManageRoles}
                      isSelf={user.id === viewer.id}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="nums text-xs text-ink-500 dark:text-ink-400">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonClass("secondary", "sm")}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonClass("secondary", "sm")}>
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
