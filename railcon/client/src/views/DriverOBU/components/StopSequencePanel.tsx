import { useMemo } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import type { ActiveSession, TimetableStop } from '../../../lib/types';
import { formatTime, getStopStatus, getDelayBadge } from '../../../lib/utils';

interface StopSequencePanelProps {
  session: ActiveSession;
}

export function StopSequencePanel({ session }: StopSequencePanelProps) {
  const stops = useMemo(() => session.timetable?.stops || [], [session.timetable?.stops]);
  const currentIndex = session.currentStopIndex;

  const getStatusConfig = (index: number) => {
    if (index < currentIndex) return { label: 'DEPARTED', className: 'text-rail-textDim', icon: CheckCircle, bg: 'bg-rail-green/10' };
    if (index === currentIndex) return { label: 'AT STOP', className: 'text-rail-gold', icon: MapPin, bg: 'bg-rail-gold/10' };
    if (index === currentIndex + 1) return { label: 'NEXT', className: 'text-rail-blue', icon: ChevronRight, bg: 'bg-rail-blue/10' };
    return { label: 'UPCOMING', className: 'text-rail-textMuted', icon: Clock, bg: '' };
  };

  if (stops.length === 0) {
    return (
      <div className="w-[40%] border-r border-rail-border bg-rail-panel flex flex-col">
        <div className="panel-header">
          <h2 className="panel-title">Stop Sequence</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-rail-textMuted">
          No timetable loaded
        </div>
      </div>
    );
  }

  return (
    <div className="w-[40%] border-r border-rail-border bg-rail-panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <h2 className="panel-title">Stop Sequence</h2>
        <span className="badge-gold">{stops.length} stops</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {stops.map((stop, index) => {
          const status = getStatusConfig(index);
          const StatusIcon = status.icon;
          const delay = session.delayMinutes;
          const isDelayed = delay > 0 && index >= currentIndex;
          
          return (
            <div
              key={stop.id}
              className={`relative p-3 rounded-lg transition-all duration-200 ${
                index === currentIndex ? 'bg-rail-gold/5 border border-rail-gold/30' : 
                index < currentIndex ? 'opacity-60' : 'hover:bg-rail-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${status.bg}`}>
                    <StatusIcon className={`w-4 h-4 ${status.className}`} />
                  </div>
                  {index < stops.length - 1 && (
                    <div className="w-0.5 h-8 bg-rail-border" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-rail-text">{stop.station?.name || 'Unknown'}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${status.bg}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-rail-textMuted">
                    {stop.scheduledArrival && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Arr: {formatTime(stop.scheduledArrival)}
                      </span>
                    )}
                    {stop.scheduledDeparture && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Dep: {formatTime(stop.scheduledDeparture)}
                      </span>
                    )}
                  </div>

                  {isDelayed && (
                    <div className="mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rail-yellow" />
                      <span className="text-xs text-rail-yellow font-mono">+{delay} min delay</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-lg font-bold text-rail-gold tabular-nums">
                    {index + 1}
                  </span>
                  {isDelayed && (
                    <span className="badge-yellow">+{delay}'</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
