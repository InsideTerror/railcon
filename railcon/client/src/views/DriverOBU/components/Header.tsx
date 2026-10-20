import { useEffect, useState } from 'react';
import { Wifi, Satellite, AlertTriangle, CheckCircle, XCircle, LogOut, Train } from 'lucide-react';
import type { ActiveSession } from '../../../lib/types';

interface HeaderProps {
  session: ActiveSession;
  wsConnected: boolean;
  onLogoutClick: () => void;
}

export function Header({ session, wsConnected, onLogoutClick }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getDeviationStatus = (delayMinutes: number) => {
    if (delayMinutes <= 0) return { label: 'ON TIME', className: 'badge-green', icon: CheckCircle };
    if (delayMinutes <= 5) return { label: `+${delayMinutes} MIN`, className: 'badge-yellow', icon: AlertTriangle };
    if (delayMinutes > 10) return { label: 'EARLY!', className: 'badge-red', icon: XCircle };
    return { label: `+${delayMinutes} MIN`, className: 'badge-yellow', icon: AlertTriangle };
  };

  const deviation = getDeviationStatus(session.delayMinutes);
  const DeviationIcon = deviation.icon;

  return (
    <header className="h-16 bg-rail-panel border-b border-rail-border flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-8 h-8 rounded-lg bg-rail-gold/10 flex items-center justify-center">
          <Train className="w-5 h-5 text-rail-gold" />
        </div>
        <div>
          <div className="text-xs text-rail-textDim uppercase tracking-wide">Driver</div>
          <div className="font-mono text-lg font-semibold text-rail-text">{session.driver?.forteId || '—'}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-xs text-rail-textDim uppercase tracking-wide">Route / Run</div>
          <div className="font-mono text-lg font-semibold text-rail-text">
            {session.timetable?.route?.id || '—'} / {session.timetable?.runNumber || '—'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <Wifi className={`w-4 h-4 ${wsConnected ? 'text-rail-green' : 'text-rail-red'}`} />
            <span className="text-xs font-medium">{wsConnected ? 'WS' : 'OFFLINE'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10">
            <Satellite className="w-4 h-4 text-rail-blue" />
            <span className="text-xs font-medium text-rail-blue">GPS</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10">
            <Wifi className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-400">GSM</span>
          </div>
        </div>

        <div className="text-center min-w-[100px]">
          <div className="text-xs text-rail-textDim uppercase tracking-wide">Time</div>
          <div className="font-mono text-lg font-semibold text-rail-gold tabular-nums">
            {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
        </div>

        <div className="flex items-center justify-center min-w-[140px]">
          <DeviationIcon className="w-4 h-4 mr-1" />
          <span className={`${deviation.className} px-3 py-1.5 text-sm`}>
            {deviation.label}
          </span>
        </div>
      </div>

      <button
        onClick={onLogoutClick}
        className="btn-ghost p-2 min-w-[48px] min-h-[48px]"
        aria-label="Logout options"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </header>
  );
}
