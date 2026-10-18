"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Label, Modal, Select } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

export function UserActions({
  userId,
  username,
  role,
  status,
  canManageRoles,
  isSelf,
}: {
  userId: string;
  username: string;
  role: string;
  status: string;
  canManageRoles: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const [nextStatus, setNextStatus] = useState(status === "DELETED" ? "SUSPENDED" : status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiJson(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(nextRole !== role ? { role: nextRole } : {}),
          ...(nextStatus !== status ? { status: nextStatus } : {}),
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Manage
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Manage ${username}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={(nextRole === role && nextStatus === status) || isSelf} onClick={() => void save()}>
              Save changes
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="mb-3 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-600 dark:bg-danger-500/10 dark:text-danger-500">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Role changes and suspensions revoke the user&apos;s sessions immediately and are recorded in the audit log.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user-role">Role</Label>
            <Select
              id="user-role"
              value={nextRole}
              disabled={!canManageRoles || isSelf}
              onChange={(event) => setNextRole(event.target.value)}
            >
              <option value="STUDENT">Student</option>
              <option value="QUESTION_EDITOR">Question editor</option>
              <option value="EXAM_MANAGER">Exam manager</option>
              <option value="ADMIN">Administrator</option>
              <option value="SUPER_ADMIN">Super administrator</option>
            </Select>
            {!canManageRoles ? (
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Only super administrators can change roles.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="user-status">Status</Label>
            <Select
              id="user-status"
              value={nextStatus}
              disabled={isSelf}
              onChange={(event) => setNextStatus(event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
            {isSelf ? <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">You cannot change your own account.</p> : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
