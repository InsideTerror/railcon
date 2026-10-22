import { useState } from "react";
import { adminApi, btnCls, CrudTable, errText, ErrorBox, Field, inputCls, Modal, primaryCls, StationListEditor, useList } from "./ui";

interface Route {
  id: string;
  name: string;
  description: string;
  stops: { stationId: number; name: string; index: number }[];
}
interface Draft {
  isNew: boolean;
  id: string;
  name: string;
  description: string;
  stationIds: number[];
}

export function RoutesTab() {
  const { rows, error, reload, setError } = useList<Route>("/api/admin/routes");
  const stations = useList<{ id: number; name: string }>("/api/admin/stations");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setFormError(null);
    try {
      if (draft.isNew) {
        await adminApi("/api/admin/routes", "POST", { id: draft.id.trim(), name: draft.name.trim(), description: draft.description, stationIds: draft.stationIds });
      } else {
        await adminApi(`/api/admin/routes/${encodeURIComponent(draft.id)}`, "PUT", { name: draft.name.trim(), description: draft.description, stationIds: draft.stationIds });
      }
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(errText(e));
    }
  }

  async function remove(r: Route) {
    if (!window.confirm(`Delete route ${r.id} including all of its timetables?`)) return;
    try {
      await adminApi(`/api/admin/routes/${encodeURIComponent(r.id)}`, "DELETE");
      await reload();
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Routes</h2>
        <button className={primaryCls} onClick={() => setDraft({ isNew: true, id: "", name: "", description: "", stationIds: [] })}>
          + New route
        </button>
      </div>
      <ErrorBox message={error ?? stations.error} />
      <CrudTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { header: "ID", render: (r) => <span className="font-mono font-bold">{r.id}</span> },
          { header: "Name", render: (r) => r.name },
          { header: "Stops", render: (r) => r.stops.map((s) => s.name).join(" → ") || "—" },
        ]}
        onEdit={(r) => setDraft({ isNew: false, id: r.id, name: r.name, description: r.description, stationIds: r.stops.map((s) => s.stationId) })}
        onDelete={(r) => void remove(r)}
      />
      {draft && (
        <Modal title={draft.isNew ? "New route" : `Edit route ${draft.id}`} onClose={() => setDraft(null)} wide>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Route ID (e.g. S70)">
              <input className={inputCls} value={draft.id} disabled={!draft.isNew} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
            </Field>
            <Field label="Name">
              <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <textarea className={inputCls} rows={2} maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <div>
            <div className="text-sm text-obu-dim mb-1">Stop sequence (outbound order)</div>
            <StationListEditor value={draft.stationIds} onChange={(v) => setDraft({ ...draft, stationIds: v })} stations={stations.rows} />
          </div>
          <ErrorBox message={formError} />
          <div className="flex justify-end gap-2">
            <button className={btnCls} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className={primaryCls} disabled={!draft.id.trim() || !draft.name.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
