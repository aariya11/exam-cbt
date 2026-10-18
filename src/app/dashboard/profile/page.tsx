import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "@/components/dashboard/profile-forms";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile & privacy",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [profile, consents, attemptCount, achievementCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        email: true,
        username: true,
        displayName: true,
        state: true,
        city: true,
        timezone: true,
        leaderboardOptOut: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    prisma.consentRecord.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" }, take: 10 }),
    prisma.attempt.count({ where: { userId: user.id } }),
    prisma.userAchievement.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Profile & privacy</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Your account details, security settings and the data controls you own.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Username" value={`@${profile.username}`} hint={profile.email} />
        <Stat
          label="Email status"
          value={profile.emailVerifiedAt ? "Verified" : "Unverified"}
          hint={profile.emailVerifiedAt ? `since ${formatDate(profile.emailVerifiedAt)}` : "check your inbox"}
        />
        <Stat label="Member since" value={formatDate(profile.createdAt)} hint={`${attemptCount} attempt(s)`} />
        <Stat label="Achievements" value={achievementCount} hint="milestones unlocked" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Profile details" description="Visible to you; your name and state appear on leaderboards unless you opt out below" />
          <CardBody>
            <ProfileForm
              initial={{
                displayName: profile.displayName,
                state: profile.state,
                city: profile.city,
                timezone: profile.timezone,
                leaderboardOptOut: profile.leaderboardOptOut,
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Security" description="Change your password" />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Consent history" description="What you agreed to, and when" />
            <CardBody className="space-y-2">
              {consents.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">No consent records found.</p>
              ) : (
                consents.map((consent) => (
                  <div key={consent.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-700 dark:text-ink-200">
                      {consent.kind} · version {consent.version}
                    </span>
                    <span className="nums text-xs text-ink-400 dark:text-ink-500">{formatDateTime(consent.grantedAt)}</span>
                  </div>
                ))
              )}
              <p className="pt-1 text-xs leading-5 text-ink-400 dark:text-ink-500">
                Read the{" "}
                <Link href="/privacy" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                  privacy policy
                </Link>{" "}
                to understand exactly what is stored and why.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="border-danger-500/30">
        <CardHeader
          title="Danger zone"
          description="Irreversible actions - deleting your account removes your personal data, attempts, results and ranks"
        />
        <CardBody>
          <DeleteAccountForm username={`@${profile.username}`} />
        </CardBody>
      </Card>
    </div>
  );
}
