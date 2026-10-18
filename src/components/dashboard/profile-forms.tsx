"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, FieldError, Input, Label, Select } from "@/components/ui";
import { INDIA_STATES } from "@/lib/constants";

type ProfileProps = {
  initial: {
    displayName: string;
    state: string | null;
    city: string | null;
    timezone: string;
    leaderboardOptOut: boolean;
  };
};

const timezones = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "UTC", "Europe/London", "America/New_York"];

export function ProfileForm({ initial }: ProfileProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: String(form.get("displayName") ?? ""),
          state: String(form.get("state") ?? "") || null,
          city: String(form.get("city") ?? "") || null,
          timezone: String(form.get("timezone") ?? "Asia/Kolkata"),
          leaderboardOptOut: form.get("leaderboardOptOut") === "on",
        }),
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "We could not save your profile.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network problem - try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {saved ? <Alert tone="success">Profile saved.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} required maxLength={80} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="state">State</Label>
          <Select id="state" name="state" defaultValue={initial.state ?? ""}>
            <option value="">Prefer not to say</option>
            {INDIA_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={initial.city ?? ""} maxLength={80} />
        </div>
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" name="timezone" defaultValue={initial.timezone}>
          {timezones.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
          Used for displaying dates. Test deadlines always run on server time.
        </p>
      </div>
      <div className="flex items-start gap-2.5 rounded-lg border border-ink-200 px-3.5 py-3 dark:border-ink-700">
        <input
          id="leaderboardOptOut"
          name="leaderboardOptOut"
          type="checkbox"
          defaultChecked={initial.leaderboardOptOut}
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
        />
        <label htmlFor="leaderboardOptOut" className="text-xs leading-5 text-ink-600 dark:text-ink-300">
          <span className="font-medium text-ink-900 dark:text-ink-100">Hide me from public leaderboards.</span> Your
          scores and analytics stay fully available to you; you simply stop appearing in public rankings, including
          historical ones.
        </label>
      </div>
      <Button type="submit" loading={busy}>
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (newPassword !== confirm) {
      setFieldErrors({ confirm: "Passwords do not match." });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword,
        }),
      });
      const body = (await response.json()) as { error?: { message: string; fields?: Record<string, string[]> } };
      if (!response.ok) {
        if (body.error?.fields) {
          const mapped: Record<string, string> = {};
          for (const [key, messages] of Object.entries(body.error.fields)) mapped[key] = messages[0] ?? "";
          setFieldErrors(mapped);
        }
        setError(body.error?.message ?? "We could not change your password.");
        return;
      }
      setDone(true);
      event.currentTarget.reset();
    } catch {
      setError("Network problem - try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {done ? (
        <Alert tone="success">
          Password changed. For security, every other device has been signed out - this session remains active.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        <FieldError>{fieldErrors.currentPassword}</FieldError>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          <FieldError>{fieldErrors.newPassword}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          <FieldError>{fieldErrors.confirm}</FieldError>
        </div>
      </div>
      <Button type="submit" variant="secondary" loading={busy}>
        Change password
      </Button>
      <p className="text-xs leading-5 text-ink-400 dark:text-ink-500">
        Changing your password signs out every other device.
      </p>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: String(form.get("password") ?? ""),
          confirm: String(form.get("confirm") ?? ""),
        }),
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "We could not delete your account.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network problem - try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-danger-500/40 bg-danger-50 p-4 dark:bg-danger-500/10" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Alert tone="danger" title="This cannot be undone">
        Your account ({username}), attempts, results and personal data will be permanently deleted. Ranks and history
        disappear with it.
      </Alert>
      <div>
        <Label htmlFor="delete-password">Your password</Label>
        <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="delete-confirm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </Label>
        <Input id="delete-confirm" name="confirm" required pattern="DELETE" autoComplete="off" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={busy}>
          Permanently delete
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
