import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { ACHIEVEMENTS, type AchievementCode } from "@/lib/constants";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { Award, Flag, Flame, Repeat, Star, Target, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Achievements",
};

const icons: Record<string, typeof Trophy> = {
  flag: Flag,
  repeat: Repeat,
  star: Star,
  target: Target,
  flame: Flame,
  trophy: Trophy,
};

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const earned = await prisma.userAchievement.findMany({
    where: { userId: user.id },
    include: { achievement: true },
  });
  const attemptIds = earned.map((row) => row.attemptId).filter((id): id is string => Boolean(id));
  const attempts = attemptIds.length
    ? await prisma.attempt.findMany({
        where: { id: { in: attemptIds } },
        select: { id: true, exam: { select: { title: true } } },
      })
    : [];
  const attemptTitleById = new Map(attempts.map((attempt) => [attempt.id, attempt.exam.title]));
  const earnedByCode = new Map(earned.map((row) => [row.achievement.code, row]));
  const codes = Object.keys(ACHIEVEMENTS) as AchievementCode[];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Achievements</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Milestones earned through genuine attempts. {earned.length} of {codes.length} unlocked.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {codes.map((code) => {
          const definition = ACHIEVEMENTS[code];
          const row = earnedByCode.get(code);
          const Icon = icons[definition.icon] ?? Award;
          return (
            <Card key={code} className={row ? "" : "opacity-70"}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Icon className={row ? "h-4 w-4 text-warn-500" : "h-4 w-4 text-ink-400"} aria-hidden />
                    {definition.title}
                  </span>
                }
                action={row ? <Badge tone="success">Unlocked</Badge> : <Badge tone="neutral">Locked</Badge>}
              />
              <CardBody>
                <p className="text-sm leading-6 text-ink-600 dark:text-ink-300">{definition.description}</p>
                {row ? (
                  <p className="nums mt-2 text-xs text-ink-400 dark:text-ink-500">
                    Earned {formatDate(row.earnedAt)}
                    {row.attemptId && attemptTitleById.get(row.attemptId) ? ` · ${attemptTitleById.get(row.attemptId)}` : ""}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
