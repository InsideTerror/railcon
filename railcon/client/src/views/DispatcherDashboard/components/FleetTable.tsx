import { MapPin, Clock, User, AlertTriangle, TrendingUp, Radio } from 'lucide-react';
import type { ActiveSession } from '../../../lib/types';
import { formatTime } from '../../../lib/utils';

interface FleetTableProps {
  sessions: ActiveSession[];
  activeTab: 'active' | 'idle' | 'nonActive';
}

export function FleetTable({ sessions, activeTab }: FleetTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-rail-textMuted">
        <div className="text-center">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {activeTab} units</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-rail-textMuted uppercase tracking-wider text-xs border-b border-rail-border">
              <th className="pb-2 pr-4">Client ID</th>
              <th className="pb-2 pr-4">Driver</th>
              <th className="pb-2 pr-4">Route / Run</th>
              <th className="pb-2 pr-4">Current Stop</th>
              <th className="pb-2 pr-4">Next Stop</th>
              <th className="pb-2 pr-4">Delay</th>
              <th className="pb-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.clientId} className="border-b border-rail-border/50 hover:bg-rail-border/30 transition-colors">
                <td className="py-3 pr-4 font-mono text-rail-text">{session.clientId}</td>
                <td className="py-3 pr-4">
                  {session.driver ? (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-rail-textMuted" />
                      <span className="font-medium">{session.driver.name}</span>
                      <span className="text-xs text-rail-textMuted font-mono">({session.driver.forteId})</span>
                    </div>
                  ) : (
                    <span className="text-rail-textDim">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {session.timetable ? (
                    <div>
                      <div className="font-mono text-rail-gold">{session.timetable.route?.id} / {session.timetable.runNumber}</div>
                      <div className="text-xs text-rail-textMuted">{session.timetable.route?.name}</div>
                    </div>
                  ) : (
                    <span className="text-rail-textDim">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {session.timetable?.stops?.[session.currentStopIndex] ? (
                    <div>
                      <div className="font-medium text-rail-text">{session.timetable.stops[session.currentStopIndex].station?.name}</div>
                      <div className="text-xs text-rail-textMuted font-mono">
                        {formatTime(session.timetable.stops[session.currentStopIndex].scheduledDeparture)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-rail-textDim">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {session.timetable?.stops?.[session.currentStopIndex + 1] ? (
                    <div className="text-rail-blue">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {session.timetable.stops[session.currentStopIndex + 1].station?.name}
                    </div>
                  ) : (
                    <span className="text-rail-textDim">Terminal</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {session.delayMinutes !== 0 ? (
                    <span className={`font-mono font-semibold ${
                      session.delayMinutes > 10 ? 'text-rail-red' :
                      session.delayMinutes > 0 ? 'text-rail-yellow' : 'text-rail-green'
                    }`}>
                      {session.delayMinutes > 0 ? '+' : ''}{session.delayMinutes} min
                    </span>
                  ) : (
                    <span className="text-rail-green font-mono">On time</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`badge ${
                    activeTab === 'active' ? 'badge-green' :
                    activeTab === 'idle' ? 'badge-yellow' : 'badge-red'
                  }`}>
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
