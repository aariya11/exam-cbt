import { prisma } from "./db";
import { SYSTEM_SETTING_KEYS } from "./constants";

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string, updatedById?: string | null) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value, updatedById: updatedById ?? null },
    create: { key, value, updatedById: updatedById ?? null },
  });
}

export async function isMaintenanceMode(): Promise<boolean> {
  return (await getSetting(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE, "false")) === "true";
}

export async function isRegistrationOpen(): Promise<boolean> {
  return (await getSetting(SYSTEM_SETTING_KEYS.REGISTRATION_OPEN, "true")) === "true";
}
