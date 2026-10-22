import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

export const inputCls = "w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-2 text-obu-text";
export const btnCls = "rounded-lg px-3 py-2 text-sm font-semibold border border-obu-line bg-obu-panel2 hover:bg-sky-900 disabled:opacity-40";
export const primaryCls = "rounded-lg px-4 py-2 text-sm font-bold bg-sky-500 text-black hover:bg-sky-400 disabled:opacity-40";
export const dangerCls = "rounded-lg px-3 py-2 text-sm font-semibold bg-bad/80 text-white hover:bg-bad disabled:opacity-40";

export function adminApi<T = unknown>(path: string, method: string = "GET", body?: unknown): Promise<T> {
  return api<T>(path, { method, body, scope: "admin" });
}

export function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Request failed";
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg bg-bad/20 border border-bad text-bad px-3 py-2 text-sm">
      {message}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm text-obu-dim ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-lg"} mt-8 rounded-xl border border-obu-line bg-obu-panel p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className={btnCls} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Loads a list from the admin API and exposes reload + error state. */
export function useList<T>(path: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    try {
      setRows(await adminApi<T[]>(path));
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, error, loading, reload, setError };
}

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

export function CrudTable<T>({
  rows,
  columns,
  rowKey,
  onEdit,
  onDelete,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-obu-line">
      <table className="w-full text-sm">
        <thead className="bg-obu-panel">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="text-left text-xs uppercase tracking-wide text-obu-dim px-3 py-2">
                {c.header}
              </th>
            ))}
            <th className="px-3 py-2 w-40" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-obu-line hover:bg-obu-panel2">
              {columns.map((c) => (
                <td key={c.header} className="px-3 py-2">
                  {c.render(r)}
                </td>
              ))}
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button className={`${btnCls} mr-2`} onClick={() => onEdit(r)}>
                  Edit
                </button>
                <button className={dangerCls} onClick={() => onDelete(r)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-obu-dim" colSpan={columns.length + 1}>
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Ordered list of station ids with add / remove / move up / move down. */
export function StationListEditor({ value, onChange, stations }: { value: number[]; onChange: (v: number[]) => void; stations: { id: number; name: string }[] }) {
  const [pick, setPick] = useState("");
  const name = (id: number) => stations.find((s) => s.id === id)?.name ?? `#${id}`;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1">
        {value.map((id, i) => (
          <li key={`${id}-${i}`} className="flex items-center gap-2 rounded-lg bg-obu-bg border border-obu-line px-3 py-1.5">
            <span className="w-6 text-obu-dim font-mono">{i + 1}</span>
            <span className="flex-1">{name(id)}</span>
            <button type="button" className={btnCls} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </button>
            <button type="button" className={btnCls} onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">
              ↓
            </button>
            <button type="button" className={dangerCls} onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove">
              ✕
            </button>
          </li>
        ))}
        {value.length === 0 && <li className="text-obu-dim text-sm">No stops yet.</li>}
      </ol>
      <div className="flex gap-2">
        <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Station to add">
          <option value="">Add station…</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btnCls}
          disabled={!pick}
          onClick={() => {
            onChange([...value, Number(pick)]);
            setPick("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
