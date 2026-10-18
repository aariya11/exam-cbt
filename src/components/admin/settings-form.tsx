"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

export function SettingsForm({
  initial,
  canEdit,
}: {
  initial: { maintenanceMode: boolean; registrationOpen: boolean };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [maintenanceMode, setMaintenanceMode] = useState(initial.maintenanceMode);
  const [registrationOpen, setRegistrationOpen] = useState(initial.registrationOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = maintenanceMode !== initial.maintenanceMode || registrationOpen !== initial.registrationOpen;

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiJson<{ maintenanceMode: boolean; registrationOpen: boolean }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ maintenanceMode, registrationOpen }),
      });
      setMaintenanceMode(result.maintenanceMode);
      setRegistrationOpen(result.registrationOpen);
      setNotice("Settings saved.");
      router.refresh();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger" title="Could not save">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {!canEdit ? (
        <Alert tone="info" title="Read-only for your role">
          Only super administrators can change platform settings. You can view the current state here.
        </Alert>
      ) : null}

      <div className="space-y-4 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">Maintenance mode</span>
            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
              Shows the maintenance page instead of the public site. Attempts already in progress are not interrupted;
              finalisation, saving and submission endpoints keep working so no candidate loses progress.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600"
            checked={maintenanceMode}
            disabled={!canEdit || busy}
            onChange={(event) => setMaintenanceMode(event.target.checked)}
          />
        </label>

        <div className="border-t border-ink-100 dark:border-ink-800" />

        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">Registration open</span>
            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
              When closed, new accounts cannot be created. Existing users can still sign in.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600"
            checked={registrationOpen}
            disabled={!canEdit || busy}
            onChange={(event) => setRegistrationOpen(event.target.checked)}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <Button loading={busy} disabled={!canEdit || !dirty} onClick={() => void save()}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
