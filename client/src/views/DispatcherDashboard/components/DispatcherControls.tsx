import { useState } from 'react';
import { Trash2, Plus, Clock, Send, UserX, MapPin, AlertTriangle } from 'lucide-react';
import type { FleetData, ActiveSession } from '../../../lib/types';
import { api } from '../../../lib/api';

interface DispatcherControlsProps {
  fleet: FleetData;
}

export function DispatcherControls({ fleet }: DispatcherControlsProps) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [truncateIndex, setTruncateIndex] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'STATUS' | 'DISPATCH_POPUP'>('DISPATCH_POPUP');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'role' | 'selection'>('role');
  const [broadcastRole, setBroadcastRole] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER');
  const [loading, setLoading] = useState(false);

  const allSessions = [...fleet.active, ...fleet.idle, ...fleet.nonActive];
  const selectedSession = allSessions.find(s => s.clientId === selectedClient);

  const handleTruncate = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      await api.truncateStops({ clientId: selectedClient, newStopIndex: truncateIndex });
    } catch (err) {
      console.error('Truncate failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleOverride = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      await api.scheduleOverride({ clientId: selectedClient, delayMinutes });
    } catch (err) {
      console.error('Schedule override failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setLoading(true);
    try {
      await api.broadcast({
        content: broadcastMessage,
        type: broadcastType,
        role: broadcastTarget === 'role' ? broadcastRole : undefined,
      });
      setBroadcastMessage('');
    } catch (err) {
      console.error('Broadcast failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminate = async () => {
    if (!selectedClient || !confirm('Terminate this session?')) return;
    setLoading(true);
    try {
      await api.terminateSession(selectedClient);
      setSelectedClient(null);
    } catch (err) {
      console.error('Terminate failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[30%] bg-rail-panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <h2 className="panel-title">Dispatcher Controls</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="card">
          <h3 className="font-semibold text-rail-text mb-3 flex items-center gap-2">
            <UserX className="w-4 h-4 text-rail-gold" />
            Session Control
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-rail-textMuted mb-1">Select Unit</label>
              <select
                value={selectedClient || ''}
                onChange={(e) => setSelectedClient(e.target.value || null)}
                className="input"
              >
                <option value="">-- Select OBU --</option>
                {allSessions.map((s) => (
                  <option key={s.clientId} value={s.clientId}>
                    {s.clientId} - {s.driver?.name || 'No driver'} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedSession && (
              <div className="space-y-3 pt-3 border-t border-rail-border">
                <div>
                  <label className="block text-xs text-rail-textMuted mb-1">Truncate Stops (jump to stop #)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={selectedSession.timetable?.stops.length - 1 || 0}
                      value={truncateIndex}
                      onChange={(e) => setTruncateIndex(parseInt(e.target.value) || 0)}
                      className="input flex-1"
                    />
                    <button
                      onClick={handleTruncate}
                      disabled={loading}
                      className="btn-primary"
                    >
                      <MapPin className="w-4 h-4" />
                      Go
                    </button>
                  </div>
                  <p className="text-xs text-rail-textMuted mt-1">
                    Max: {selectedSession.timetable?.stops.length - 1 || 0} stops
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-rail-textMuted mb-1">Schedule Override (delay minutes)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                      className="input flex-1"
                      placeholder="0"
                    />
                    <button
                      onClick={handleScheduleOverride}
                      disabled={loading}
                      className="btn-primary"
                    >
                      <Clock className="w-4 h-4" />
                      Apply
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleTerminate}
                  disabled={loading}
                  className="btn-danger w-full justify-start"
                >
                  <Trash2 className="w-4 h-4" />
                  Terminate Session
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-rail-text mb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-rail-gold" />
            Broadcast Message
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-rail-textMuted mb-1">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="input min-h-[80px]"
                placeholder="Enter broadcast message..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value as any)} className="input">
                <option value="DISPATCH_POPUP">Pop-up Alert</option>
                <option value="STATUS">Status Message</option>
              </select>
              <select value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value as any)} className="input">
                <option value="role">By Role</option>
                <option value="all">All Units</option>
              </select>
            </div>
            {broadcastTarget === 'role' && (
              <select value={broadcastRole} onChange={(e) => setBroadcastRole(e.target.value as any)} className="input">
                <option value="DRIVER">Drivers</option>
                <option value="DISPATCHER">Dispatchers</option>
              </select>
            )}
            <button onClick={handleBroadcast} disabled={loading || !broadcastMessage.trim()} className="btn-primary w-full">
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Broadcast'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-rail-text mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-rail-gold" />
            Relief Run Injection
          </h3>
          <p className="text-sm text-rail-textMuted mb-3">Create emergency relief timetable</p>
          <button className="btn-secondary w-full justify-start" disabled={loading}>
            <Plus className="w-4 h-4" />
            Create Relief Run
          </button>
        </div>
      </div>
    </div>
  );
}
