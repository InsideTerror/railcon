import { useState } from "react";
import { useObu } from "./store";

export function Login() {
  const { send, loginError, connected } = useObu();
  const [forteId, setForteId] = useState("");
  const [pin, setPin] = useState("");
  const [field, setField] = useState<"id" | "pin">("id");

  const press = (d: string) => {
    if (field === "id") setForteId((v) => (v + d).slice(0, 12));
    else setPin((v) => (v + d).slice(0, 8));
  };
  const back = () => (field === "id" ? setForteId((v) => v.slice(0, -1)) : setPin((v) => v.slice(0, -1)));
  const submit = () => {
    if (!forteId || pin.length < 6) return;
    send({ t: "login", forteId, pin });
    setPin("");
  };

  return (
    <div className="h-full flex items-center justify-center bg-obu-bg p-6">
      <div className="w-full max-w-3xl grid grid-cols-2 gap-8">
        <div className="flex flex-col justify-center gap-5">
          <div>
            <div className="text-4xl font-black tracking-wide text-sky-400">C.O.R.E.</div>
            <div className="text-obu-dim text-lg">Corporation Of Railway Engineering</div>
          </div>
          <div className="text-xl font-semibold">Driver Log-in</div>
          <button
            onClick={() => setField("id")}
            className={`text-left rounded-xl border-2 px-4 py-3 ${field === "id" ? "border-sky-400 bg-obu-panel2" : "border-obu-line bg-obu-panel"}`}
          >
            <div className="text-sm text-obu-dim">Driver ID</div>
            <div className="text-3xl font-mono h-10">{forteId || <span className="text-obu-line">---</span>}</div>
          </button>
          <button
            onClick={() => setField("pin")}
            className={`text-left rounded-xl border-2 px-4 py-3 ${field === "pin" ? "border-sky-400 bg-obu-panel2" : "border-obu-line bg-obu-panel"}`}
          >
            <div className="text-sm text-obu-dim">PIN (6-8 digits)</div>
            <div className="text-3xl font-mono h-10 tracking-widest">{"•".repeat(pin.length) || <span className="text-obu-line">------</span>}</div>
          </button>
          {loginError && <div className="rounded-lg bg-bad/20 border border-bad text-bad px-4 py-2">{loginError}</div>}
          {!connected && <div className="rounded-lg bg-amber/20 border border-amber text-amber px-4 py-2">Connecting to the server...</div>}
        </div>

        <div className="grid grid-cols-3 gap-3 content-center">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="h-20 rounded-xl bg-obu-panel2 border border-obu-line text-3xl font-semibold active:bg-sky-900">
              {d}
            </button>
          ))}
          <button onClick={back} className="h-20 rounded-xl bg-obu-panel2 border border-obu-line text-2xl active:bg-sky-900" aria-label="Backspace">
            ⌫
          </button>
          <button onClick={() => press("0")} className="h-20 rounded-xl bg-obu-panel2 border border-obu-line text-3xl font-semibold active:bg-sky-900">
            0
          </button>
          <button
            onClick={() => (field === "id" ? setField("pin") : submit())}
            disabled={field === "pin" && (!forteId || pin.length < 6)}
            className="h-20 rounded-xl bg-sky-500 text-obu-bg text-xl font-bold disabled:opacity-40 active:bg-sky-300"
          >
            {field === "id" ? "NEXT" : "LOG IN"}
          </button>
        </div>
      </div>
    </div>
  );
}
