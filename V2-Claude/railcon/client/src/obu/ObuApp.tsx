import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Login } from "./Login";
import { ProgressStrip } from "./ProgressStrip";
import { AnnounceTab, DutyTab, InboxTab, MessageTab, SettingsTab } from "./Tabs";
import { useObu } from "./store";

type TabId = "duty" | "message" | "announce" | "settings" | "inbox";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "duty", label: "Duty / Activity", icon: "☰" },
  { id: "message", label: "Send Message", icon: "✉" },
  { id: "announce", label: "Announcements", icon: "🔊" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "inbox", label: "Inbox", icon: "📥" },
];

function PopupModal() {
  const { popup, dismissPopup } = useObu();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!popup) return;
    const tick = () => {
      const l = Math.ceil((popup.until - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) dismissPopup();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [popup, dismissPopup]);
  if (!popup) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={dismissPopup}>
      <div className="max-w-3xl w-full rounded-2xl border-4 border-warn bg-obu-panel p-8 shadow-2xl">
        <div className="flex justify-between text-warn font-bold text-xl mb-3">
          <span>DISPATCH MESSAGE</span>
          <span>{Math.max(left, 0)}s</span>
        </div>
        <div className="text-4xl font-bold leading-snug">{popup.text}</div>
        <div className="text-obu-dim mt-4">{popup.from} · tap to dismiss</div>
      </div>
    </div>
  );
}

function Advisories() {
  const adv = useObu((s) => s.session?.advisories ?? []);
  if (adv.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 p-2 border-b border-obu-line">
      {adv.map((a) => (
        <div key={a.id} className={`rounded-lg px-4 py-2 font-bold text-lg ${a.kind === "HOLD" ? "bg-warn text-black" : "bg-bad text-white"}`}>
          {a.kind === "HOLD" ? "⏸ " : "✖ "}
          {a.text}
          {a.detail && <span className="font-normal ml-2 text-base opacity-80">{a.detail}</span>}
        </div>
      ))}
    </div>
  );
}

function BottomStrip() {
  const { session, send, panicActive } = useObu();
  const [confirmPanic, setConfirmPanic] = useState(false);
  const run = session?.run;
  const atStop = session?.phase === "AT_STOP";
  const atTerminal = !!run && session!.currentStopIndex >= run.terminalIndex;

  return (
    <footer className="h-[96px] shrink-0 flex items-stretch gap-3 p-3 bg-obu-panel border-t border-obu-line">
      <button
        onClick={() => !panicActive && setConfirmPanic(true)}
        className={`w-[240px] rounded-xl text-2xl font-black tracking-wide border-4 ${
          panicActive ? "bg-bad border-white animate-pulse" : "bg-bad border-red-900 active:bg-red-800"
        }`}
      >
        {panicActive ? "PANIC SENT" : "⚠ PANIC"}
      </button>
      <div className="flex-1 flex items-center px-3 text-obu-dim">
        {run ? (
          atStop ? (
            <span>
              At <b className="text-obu-text">{run.stops.find((s) => s.index === session!.currentStopIndex)?.name}</b> · doors {session!.doorsOpen ? "open" : "closed"}
            </span>
          ) : (
            <span>
              Next stop: <b className="text-obu-text">{run.stops.find((s) => s.index === session!.currentStopIndex)?.name}</b>
            </span>
          )
        ) : (
          "No active run"
        )}
      </div>
      <button
        disabled={!run}
        onClick={() => send({ t: "step.manual" })}
        className="w-[200px] rounded-xl bg-obu-panel2 border border-obu-line text-xl font-bold disabled:opacity-30 active:bg-sky-900"
      >
        {atStop ? "Manual step ▶" : "Manual arrive ▶"}
      </button>
      <button
        disabled={!run}
        onClick={() => send({ t: "door", state: atStop ? "CLOSED" : "OPEN" })}
        className={`w-[280px] rounded-xl text-xl font-black disabled:opacity-30 ${atStop ? "bg-ok text-black active:bg-green-400" : "bg-warn text-black active:bg-yellow-300"}`}
      >
        {atStop ? (atTerminal ? "CLOSE DOORS · END RUN" : "CLOSE DOORS · DEPART") : "ARRIVED · OPEN DOORS"}
      </button>

      {confirmPanic && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="rounded-2xl border-4 border-bad bg-obu-panel p-8 max-w-xl text-center">
            <div className="text-3xl font-black text-bad mb-3">SEND PANIC ALERT?</div>
            <div className="text-lg text-obu-dim mb-6">Dispatch will be alerted immediately with your position and run.</div>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-4 rounded-xl bg-obu-panel2 border border-obu-line text-xl" onClick={() => setConfirmPanic(false)}>
                Cancel
              </button>
              <button
                className="px-8 py-4 rounded-xl bg-bad text-xl font-black"
                onClick={() => {
                  send({ t: "panic" });
                  setConfirmPanic(false);
                }}
              >
                SEND PANIC
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

export function ObuApp() {
  const { start, stop, session, inbox, toasts, brightness, panicActive } = useObu();
  const [tab, setTab] = useState<TabId>("duty");
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const unread = inbox.filter((m) => !m.acknowledged).length;

  // Pick the most useful tab automatically: runs after login, the inbox is never forced.
  const loggedIn = !!session?.driver;
  useEffect(() => {
    if (loggedIn) setTab("duty");
  }, [loggedIn]);

  return (
    <div className="h-full relative select-none">
      {!loggedIn ? (
        <Login />
      ) : (
        <div className="h-full flex flex-col">
          <Header />
          {panicActive && <div className="bg-bad text-white text-center font-black py-1 animate-pulse">PANIC ALERT ACTIVE — DISPATCH NOTIFIED</div>}
          <div className="flex-1 flex min-h-0">
            <section className="w-[40%] border-r border-obu-line bg-obu-bg min-h-0">
              <ProgressStrip />
            </section>
            <section className="w-[60%] flex flex-col min-h-0">
              <nav className="flex shrink-0 border-b border-obu-line bg-obu-panel">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 relative h-[64px] text-sm font-bold border-r border-obu-line last:border-r-0 flex flex-col items-center justify-center ${
                      tab === t.id ? "bg-sky-600 text-white" : "bg-obu-panel text-obu-text active:bg-sky-900"
                    }`}
                  >
                    <span className="text-xl leading-none">{t.icon}</span>
                    <span>{t.label}</span>
                    {t.id === "inbox" && unread > 0 && (
                      <span className="absolute top-1 right-2 min-w-[24px] h-6 px-1 rounded-full bg-bad text-white text-sm flex items-center justify-center">{unread}</span>
                    )}
                  </button>
                ))}
              </nav>
              <Advisories />
              <div className="flex-1 min-h-0 bg-obu-bg">
                {tab === "duty" && <DutyTab />}
                {tab === "message" && <MessageTab />}
                {tab === "announce" && <AnnounceTab />}
                {tab === "settings" && <SettingsTab />}
                {tab === "inbox" && <InboxTab />}
              </div>
            </section>
          </div>
          <BottomStrip />
        </div>
      )}

      <PopupModal />
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-5 py-3 font-semibold shadow-lg ${t.level === "error" ? "bg-bad text-white" : "bg-sky-600 text-white"}`}>
            {t.text}
          </div>
        ))}
      </div>
      {/* software brightness: black overlay, never intercepts touches */}
      <div className="fixed inset-0 z-[60] pointer-events-none bg-black" style={{ opacity: 1 - brightness }} />
    </div>
  );
}
