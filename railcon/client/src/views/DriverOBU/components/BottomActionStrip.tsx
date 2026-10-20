import { useState } from 'react';
import { AlertTriangle, DoorOpen, DoorClosed, Zap, CheckCircle } from 'lucide-react';
import { api } from '../../../lib/api';

interface BottomActionStripProps {
  session: any;
}

export function BottomActionStrip(_props: BottomActionStripProps) {
  const [doorOpen, setDoorOpen] = useState(false);
  const [panicPressed, setPanicPressed] = useState(false);
  const [panicConfirm, setPanicConfirm] = useState(false);

  const handlePanic = async () => {
    if (panicConfirm) {
      try {
        api.sendPanic();
        setPanicPressed(true);
        setTimeout(() => setPanicPressed(false), 3000);
      } catch (err) {
        console.error('Panic failed:', err);
      }
      setPanicConfirm(false);
    } else {
      setPanicConfirm(true);
      setTimeout(() => setPanicConfirm(false), 3000);
    }
  };

  const handleDoorToggle = async () => {
    const newState = !doorOpen;
    setDoorOpen(newState);
    try {
      api.toggleDoorWS(newState);
    } catch (err) {
      console.error('Door toggle failed:', err);
      setDoorOpen(!newState);
    }
  };

  return (
    <div className="h-20 bg-rail-panel border-t border-rail-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rail-bg border border-rail-border">
          <DoorClosed className={`w-5 h-5 ${doorOpen ? 'text-rail-green' : 'text-rail-textMuted'}`} />
          <span className="text-sm font-medium text-rail-textMuted">Doors</span>
        </div>
        <button
          onClick={handleDoorToggle}
          className={`btn ${doorOpen ? 'btn-danger' : 'btn-primary'} min-w-[140px]`}
          aria-label={doorOpen ? 'Close doors' : 'Open doors'}
        >
          {doorOpen ? (
            <>
              <DoorOpen className="w-5 h-5" />
              <span>Close Doors</span>
            </>
          ) : (
            <>
              <DoorClosed className="w-5 h-5" />
              <span>Open Doors</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handlePanic}
          className={`btn-danger relative min-w-[160px] h-14 ${panicConfirm ? 'animate-pulse ring-4 ring-rail-red/50' : ''} ${panicPressed ? 'bg-rail-green' : ''}`}
          aria-label="Emergency panic button"
        >
          {panicConfirm ? (
            <>
              <AlertTriangle className="w-6 h-6 mr-2 animate-blink" />
              <span className="font-bold text-lg">CONFIRM PANIC</span>
            </>
          ) : panicPressed ? (
            <>
              <CheckCircle className="w-6 h-6 mr-2" />
              <span className="font-bold">PANIC SENT</span>
            </>
          ) : (
            <>
              <Zap className="w-6 h-6 mr-2" />
              <span className="font-bold text-lg">PANIC</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
