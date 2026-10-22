import { useState } from "react";
import { adminApi, btnCls, CrudTable, errText, ErrorBox, Field, inputCls, Modal, primaryCls, useList } from "./ui";

type Role = "DRIVER" | "DISPATCHER" | "SYSADMIN";
interface User {
  id: number;
  forteId: string;
  name: string;
  role: Role;
}
interface Draft {
  id?: number;
  forteId: string;
  name: string;
  role: Role;
  pin: string;
}

export function UsersTab() {
  const { rows, error, reload, setError } = useList<User>("/api/admin/users");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setFormError(null);
    if (draft.pin && !/^\d{6,8}$/.test(draft.pin)) return setFormError("PIN must be 6-8 digits");
    if (draft.id === undefined && !draft.pin) return setFormError("A PIN is required for new users");
    try {
      if (draft.id === undefined) {
        await adminApi("/api/admin/users", "POST", { forteId: draft.forteId.trim(), name: draft.name.trim(), role: draft.role, pin: draft.pin });
      } else {
        await adminApi(`/api/admin/users/${draft.id}`, "PUT", {
          forteId: draft.forteId.trim(),
          name: draft.name.trim(),
          role: draft.role,
          ...(draft.pin ? { pin: draft.pin } : {}),
        });
      }
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(errText(e));
    }
  }

  async function remove(u: User) {
    if (!window.confirm(`Delete user ${u.name} (${u.forteId})?`)) return;
    try {
      await adminApi(`/api/admin/users/${u.id}`, "DELETE");
      await reload();
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Drivers &amp; users</h2>
        <button className={primaryCls} onClick={() => setDraft({ forteId: "", name: "", role: "DRIVER", pin: "" })}>
          + New user
        </button>
      </div>
      <ErrorBox message={error} />
      <CrudTable
        rows={rows}
        rowKey={(u) => u.id}
        columns={[
          { header: "Forte ID", render: (u) => <span className="font-mono">{u.forteId}</span> },
          { header: "Name", render: (u) => u.name },
          { header: "Role", render: (u) => u.role },
        ]}
        onEdit={(u) => setDraft({ id: u.id, forteId: u.forteId, name: u.name, role: u.role, pin: "" })}
        onDelete={(u) => void remove(u)}
      />
      {draft && (
        <Modal title={draft.id === undefined ? "New user" : "Edit user"} onClose={() => setDraft(null)}>
          <Field label="Forte ID (login id)">
            <input className={inputCls} value={draft.forteId} onChange={(e) => setDraft({ ...draft, forteId: e.target.value })} />
          </Field>
          <Field label="Name">
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              <option value="DRIVER">DRIVER</option>
              <option value="DISPATCHER">DISPATCHER</option>
              <option value="SYSADMIN">SYSADMIN</option>
            </select>
          </Field>
          <Field label={draft.id === undefined ? "PIN (6-8 digits)" : "New PIN (leave empty to keep current)"}>
            <input className={inputCls} type="password" inputMode="numeric" autoComplete="new-password" value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value })} />
          </Field>
          <ErrorBox message={formError} />
          <div className="flex justify-end gap-2">
            <button className={btnCls} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className={primaryCls} disabled={!draft.forteId.trim() || !draft.name.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
