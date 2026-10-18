import { prisma } from "@/lib/db";
import { handle, ok, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";

// Reference data for admin forms (categories, subjects with topics).
export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.QUESTION_EDITOR);

  const [categories, subjects] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({
      include: { topics: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return ok({
    categories: categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
    subjects: subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
      topics: subject.topics.map((topic) => ({ id: topic.id, name: topic.name })),
    })),
  });
});
