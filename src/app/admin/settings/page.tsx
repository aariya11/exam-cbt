import { getCurrentUser } from "@/lib/auth-context";
import { ROLES, SYSTEM_SETTING_KEYS, isAtLeastRole } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [maintenanceMode, registrationOpen] = await Promise.all([
    getSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, "false"),
    getSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, "true"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Platform settings</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Operational switches. Every change is recorded in the audit log with the acting administrator.
        </p>
      </div>
      <Card>
        <CardHeader title="Availability" description="These switches take effect immediately" />
        <div className="px-5 py-4">
          <SettingsForm
            initial={{
              maintenanceMode: maintenanceMode === "true",
              registrationOpen: registrationOpen === "true",
            }}
            canEdit={isAtLeastRole(user.role, ROLES.SUPER_ADMIN)}
          />
        </div>
      </Card>
    </div>
  );
}
