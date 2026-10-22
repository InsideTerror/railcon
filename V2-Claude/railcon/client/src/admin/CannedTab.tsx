import { useState } from "react";
import { adminApi, btnCls, CrudTable, errText, ErrorBox, Field, inputCls, Modal, primaryCls, useList } from "./ui";

type Category = "DRIVER_TO_DISPATCH" | "PASSENGER_ANNOUNCEMENT";
interface Canned {
  id: number;
  category: Category;
  label: string;
  templateText: string;
  displayOrder: number;
}
interface Draft {
  id?: number;
  category: Category;
  label: string;
  templateText: string;
  displayOrder: string;
}

const GROUPS: { id: Category; title: string }[] = [
  { id: "DRIVER_TO_DISPATCH", title: "Driver → Dispatch messages" },
  { id: "PASSENGER_ANNOUNCEMENT", title: "Passenger announcements" },
];

export function CannedTab() {
  const { rows, error, reload, setError } = useList<Canned>("/api/admin/canned");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setFormError(null);
    const order = Number(draft.displayOrder);
    if (!Number.isInteger(order)) return setFormError("Display order must be a whole number");
    const body = { category: draft.category, label: draft.label.trim(), templateText: draft.templateText.trim(), displayOrder: order };
    try {
      if (draft.id === undefined) await adminApi("/api/admin/canned", "POST", body);
      else await adminApi(`/api/admin/canned/${draft.id}`, "PUT", body);
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(errText(e));
    }
  }

  async function remove(c: Canned) {
    if (!window.confirm(`Delete "${c.label}"?`)) return;
    try {
      await adminApi(`/api/admin/canned/${c.id}`, "DELETE");
      await reload();
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ErrorBox message={error} />
      {GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">{g.title}</h2>
            <button
              className={primaryCls}
              onClick={() => {
                setFormError(null);
                setDraft({ category: g.id, label: "", templateText: "", displayOrder: String(rows.filter((r) => r.category === g.id).length + 1) });
              }}
            >
              + New
            </button>
          </div>
          <CrudTable
            rows={rows.filter((r) => r.category === g.id)}
            rowKey={(c) => c.id}
            columns={[
              { header: "#", render: (c) => c.displayOrder },
              { header: "Label", render: (c) => <b>{c.label}</b> },
              { header: "Template text", render: (c) => c.templateText },
            ]}
            onEdit={(c) => {
              setFormError(null);
              setDraft({ id: c.id, category: c.category, label: c.label, templateText: c.templateText, displayOrder: String(c.displayOrder) });
            }}
            onDelete={(c) => void remove(c)}
          />
        </div>
      ))}
      {draft && (
        <Modal title={draft.id === undefined ? "New canned option" : "Edit canned option"} onClose={() => setDraft(null)}>
          <Field label="Category">
            <select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label (max 60)">
            <input className={inputCls} maxLength={60} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Template text (max 300)">
            <textarea className={inputCls} rows={3} maxLength={300} value={draft.templateText} onChange={(e) => setDraft({ ...draft, templateText: e.target.value })} />
          </Field>
          <Field label="Display order">
            <input className={inputCls} inputMode="numeric" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })} />
          </Field>
          <ErrorBox message={formError} />
          <div className="flex justify-end gap-2">
            <button className={btnCls} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className={primaryCls} disabled={!draft.label.trim() || !draft.templateText.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
