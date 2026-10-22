import { useState } from "react";
import { adminApi, btnCls, CrudTable, errText, ErrorBox, Field, inputCls, Modal, primaryCls, useList } from "./ui";

interface Station {
  id: number;
  name: string;
  code: string;
  lat: number | null;
  lon: number | null;
}
interface Draft {
  id?: number;
  name: string;
  code: string;
  lat: string;
  lon: string;
}

export function StationsTab() {
  const { rows, error, reload, setError } = useList<Station>("/api/admin/stations");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setFormError(null);
    const lat = draft.lat.trim() === "" ? null : Number(draft.lat);
    const lon = draft.lon.trim() === "" ? null : Number(draft.lon);
    if ((lat !== null && !Number.isFinite(lat)) || (lon !== null && !Number.isFinite(lon))) return setFormError("Latitude / longitude must be numbers");
    const body = { name: draft.name.trim(), code: draft.code.trim(), lat, lon };
    try {
      if (draft.id === undefined) await adminApi("/api/admin/stations", "POST", body);
      else await adminApi(`/api/admin/stations/${draft.id}`, "PUT", body);
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(errText(e));
    }
  }

  async function remove(s: Station) {
    if (!window.confirm(`Delete station ${s.name}? Stops that use it are removed from routes and timetables.`)) return;
    try {
      await adminApi(`/api/admin/stations/${s.id}`, "DELETE");
      await reload();
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Stations</h2>
        <button className={primaryCls} onClick={() => setDraft({ name: "", code: "", lat: "", lon: "" })}>
          + New station
        </button>
      </div>
      <ErrorBox message={error} />
      <CrudTable
        rows={rows}
        rowKey={(s) => s.id}
        columns={[
          { header: "Name", render: (s) => s.name },
          { header: "Code", render: (s) => <span className="font-mono">{s.code}</span> },
          { header: "Latitude", render: (s) => s.lat ?? "—" },
          { header: "Longitude", render: (s) => s.lon ?? "—" },
        ]}
        onEdit={(s) => setDraft({ id: s.id, name: s.name, code: s.code, lat: s.lat?.toString() ?? "", lon: s.lon?.toString() ?? "" })}
        onDelete={(s) => void remove(s)}
      />
      {draft && (
        <Modal title={draft.id === undefined ? "New station" : "Edit station"} onClose={() => setDraft(null)}>
          <Field label="Name">
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Code (unique)">
            <input className={inputCls} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude (optional)">
              <input className={inputCls} inputMode="decimal" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} />
            </Field>
            <Field label="Longitude (optional)">
              <input className={inputCls} inputMode="decimal" value={draft.lon} onChange={(e) => setDraft({ ...draft, lon: e.target.value })} />
            </Field>
          </div>
          <ErrorBox message={formError} />
          <div className="flex justify-end gap-2">
            <button className={btnCls} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className={primaryCls} disabled={!draft.name.trim() || !draft.code.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
