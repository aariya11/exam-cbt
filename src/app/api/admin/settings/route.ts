import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { settingsSchema } from "@/lib/validation";
import { ROLES, SYSTEM_SETTING_KEYS } from "@/lib/constants";
import { getSetting, setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.ADMIN);
  return ok({
    maintenanceMode: (await getSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, "false")) === "true",
    registrationOpen: (await getSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, "true")) === "true",
  });
});

export const PATCH = handle(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.SUPER_ADMIN);
  const input = await readJson(req, settingsSchema);

  const before = {
    maintenanceMode: (await getSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, "false")) === "true",
    registrationOpen: (await getSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, "true")) === "true",
  };

  if (input.maintenanceMode !== undefined) {
    await setSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, String(input.maintenanceMode), auth.user.id);
  }
  if (input.registrationOpen !== undefined) {
    await setSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, String(input.registrationOpen), auth.user.id);
  }

  await writeAudit({
    actorId: auth.user.id,
    action: "settings.updated",
    entityType: "SystemSetting",
    before,
    after: input,
  });

  return ok({
    maintenanceMode: (await getSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, "false")) === "true",
    registrationOpen: (await getSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, "true")) === "true",
  });
});
